import uuid

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Exercise
from app.seed.exercises import (
    library_exercise_id,
    load_library,
    map_exercise,
    seed_exercises,
    sentence_case,
)
from app.services.exercises import MUSCLES

pytestmark = pytest.mark.anyio


@pytest.mark.parametrize(
    ("upstream", "expected"),
    [
        ("Dumbbell Bicep Curl", "Dumbbell bicep curl"),
        ("Close-Grip EZ Bar Curl", "Close-grip EZ bar curl"),
        ("Chin-Up", "Chin-up"),
        ("3/4 Sit-Up", "3/4 sit-up"),
        ("Dips - Triceps Version", "Dips - triceps version"),
        ("Smith Machine Bench Press", "Smith machine bench press"),
        ("Single-Arm Smith Machine Shrug", "Single-arm Smith machine shrug"),
        ("Lying T-Bar Row", "Lying T-bar row"),
        ("Arnold Dumbbell Press", "Arnold dumbbell press"),
        ("Kettlebell Turkish Get-Up (Squat style)", "Kettlebell Turkish get-up (squat style)"),
    ],
)
def test_sentence_case_keeps_proper_nouns_and_abbreviations(upstream: str, expected: str) -> None:
    assert sentence_case(upstream) == expected


def test_map_exercise_takes_first_primary_and_derives_kind() -> None:
    mapped = map_exercise(
        {
            "id": "Chin-Up",
            "name": "Chin-Up",
            "category": "strength",
            "primaryMuscles": ["lats", "biceps"],
            "secondaryMuscles": ["forearms", "biceps"],
            "equipment": "body only",
        }
    )

    assert mapped == {
        "id": library_exercise_id("Chin-Up"),
        "name": "Chin-up",
        "primary_muscle": "lats",
        "secondary_muscles": ["biceps", "forearms"],
        "equipment": "body only",
        "kind": "bodyweight",
    }


def test_map_exercise_skips_stretching_and_cardio() -> None:
    base = {"id": "x", "name": "X", "primaryMuscles": ["chest"], "secondaryMuscles": []}

    assert map_exercise(base | {"category": "stretching", "equipment": None}) is None
    assert map_exercise(base | {"category": "cardio", "equipment": "machine"}) is None
    weighted = map_exercise(base | {"category": "strength", "equipment": None})
    assert weighted is not None and weighted["kind"] == "weighted"


def test_library_ids_are_stable() -> None:
    assert library_exercise_id("Barbell_Curl") == library_exercise_id("Barbell_Curl")
    assert library_exercise_id("Barbell_Curl") == uuid.UUID("5c47774c-c54e-5f3f-bf43-4708dac22512")


def test_library_file_maps_cleanly() -> None:
    library = load_library()

    assert len(library) == 739
    assert len({row["id"] for row in library}) == len(library)
    for row in library:
        assert row["primary_muscle"] in MUSCLES
        assert set(row["secondary_muscles"]) <= set(MUSCLES)
        assert row["primary_muscle"] not in row["secondary_muscles"]


async def test_seed_loads_the_library_and_is_idempotent(session: AsyncSession) -> None:
    first = await seed_exercises(session)
    assert (first.inserted, first.updated, first.removed) == (739, 0, 0)

    count = await session.scalar(
        select(func.count()).select_from(Exercise).where(Exercise.owner_user_id.is_(None))
    )
    assert count == 739

    chin_up = await session.get_one(Exercise, library_exercise_id("Chin-Up"))
    assert (chin_up.name, chin_up.kind, chin_up.primary_muscle) == ("Chin-up", "bodyweight", "lats")

    stamp = chin_up.updated_at
    second = await seed_exercises(session)
    assert (second.inserted, second.updated, second.unchanged, second.removed) == (0, 0, 739, 0)
    await session.refresh(chin_up)
    assert chin_up.updated_at == stamp


async def test_seed_repairs_edited_rows_and_retires_removed_ones(session: AsyncSession) -> None:
    await seed_exercises(session)
    curl_id = library_exercise_id("Barbell_Curl")
    await session.execute(update(Exercise).where(Exercise.id == curl_id).values(name="Edited"))
    stray = Exercise(name="Gone upstream", primary_muscle="chest", kind="weighted")
    session.add(stray)
    await session.flush()

    result = await seed_exercises(session)

    assert (result.inserted, result.updated, result.removed) == (0, 1, 1)
    session.expunge_all()
    assert (await session.get_one(Exercise, curl_id)).name == "Barbell curl"
    assert (await session.get_one(Exercise, stray.id)).deleted_at is not None
