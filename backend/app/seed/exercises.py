"""Seeds the exercise library from the vendored free-exercise-db file.

Library ids are UUIDv5 of the upstream id, so they are the same on every server and the seed
can run on every start: new exercises are inserted, changed ones are updated, unchanged ones
are left alone (so phones don't re-download them), and ones no longer in the file are
soft-deleted.
"""

import json
import re
import uuid
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

from sqlalchemy import func, literal_column, tuple_, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Exercise

DATA_FILE = Path(__file__).with_name("free_exercise_db.json")
LIBRARY_NAMESPACE = uuid.UUID("ed460aec-d1a3-42ee-92bc-8f3a717ad3ee")

# Not loggable as weight × reps.
SKIPPED_CATEGORIES = {"stretching", "cardio"}

# Words that stay capitalized in sentence-case names.
PROPER_NOUNS = {"Arnold", "Bradford", "Olympic", "Rocky", "Romanian", "Russian", "Smith", "Turkish"}
SHAPE_LETTERS = {"T", "V"}  # T-bar, V-bar

MAPPED_COLUMNS = ("name", "primary_muscle", "secondary_muscles", "equipment", "kind")


def library_exercise_id(source_id: str) -> uuid.UUID:
    return uuid.uuid5(LIBRARY_NAMESPACE, f"free-exercise-db:{source_id}")


def _keeps_case(part: str) -> bool:
    core = part.strip("()[],.")
    return core in PROPER_NOUNS or core in SHAPE_LETTERS or (len(core) > 1 and core.isupper())


def sentence_case(name: str) -> str:
    """ "Close-Grip EZ Bar Curl" -> "Close-grip EZ bar curl" (the app's copy is sentence case)."""
    words = []
    for w, word in enumerate(name.split(" ")):
        parts = word.split("-")
        words.append(
            "-".join(
                part if (w == 0 and p == 0) or _keeps_case(part) else part.lower()
                for p, part in enumerate(parts)
            )
        )
    return " ".join(words)


def map_exercise(raw: dict[str, Any]) -> dict[str, Any] | None:
    if raw["category"] in SKIPPED_CATEGORIES:
        return None
    primary, *other_primaries = raw["primaryMuscles"]
    secondary: list[str] = []
    for muscle in [*other_primaries, *raw["secondaryMuscles"]]:
        if muscle != primary and muscle not in secondary:
            secondary.append(muscle)
    return {
        "id": library_exercise_id(raw["id"]),
        "name": sentence_case(re.sub(r"\s+", " ", raw["name"]).strip()),
        "primary_muscle": primary,
        "secondary_muscles": secondary,
        "equipment": raw["equipment"],
        "kind": "bodyweight" if raw["equipment"] == "body only" else "weighted",
    }


@cache
def _load_library() -> tuple[dict[str, Any], ...]:
    raw = json.loads(DATA_FILE.read_text(encoding="utf-8"))["exercises"]
    return tuple(row for row in map(map_exercise, raw) if row is not None)


def load_library() -> list[dict[str, Any]]:
    return [dict(row) for row in _load_library()]


@dataclass(frozen=True)
class SeedResult:
    inserted: int
    updated: int
    unchanged: int
    removed: int


async def seed_exercises(session: AsyncSession) -> SeedResult:
    rows = load_library()
    stmt = insert(Exercise).values(rows)
    current = tuple_(*(getattr(Exercise, c) for c in MAPPED_COLUMNS), Exercise.deleted_at)
    incoming = tuple_(*(getattr(stmt.excluded, c) for c in MAPPED_COLUMNS), literal_column("NULL"))
    stmt = stmt.on_conflict_do_update(
        index_elements=[Exercise.id],
        set_={**{c: getattr(stmt.excluded, c) for c in MAPPED_COLUMNS}, "deleted_at": None},
        where=Exercise.owner_user_id.is_(None) & current.is_distinct_from(incoming),
    ).returning(literal_column("xmax = 0"))  # true for inserted rows, false for updated ones
    written = list(await session.scalars(stmt))
    inserted = sum(written)

    removed = await session.execute(
        update(Exercise)
        .where(
            Exercise.owner_user_id.is_(None),
            Exercise.deleted_at.is_(None),
            Exercise.id.not_in([row["id"] for row in rows]),
        )
        .values(deleted_at=func.now())
    )
    await session.commit()
    return SeedResult(
        inserted=inserted,
        updated=len(written) - inserted,
        unchanged=len(rows) - len(written),
        removed=removed.rowcount,  # type: ignore[attr-defined]
    )
