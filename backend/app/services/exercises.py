import re
import uuid
from datetime import datetime

from sqlalchemy import ColumnElement, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Exercise
from app.services.sync import NotFoundError, pull_filter

# free-exercise-db's vocabulary. Custom exercises use it too, so filters work for them.
MUSCLES = (
    "abdominals",
    "abductors",
    "adductors",
    "biceps",
    "calves",
    "chest",
    "forearms",
    "glutes",
    "hamstrings",
    "lats",
    "lower back",
    "middle back",
    "neck",
    "quadriceps",
    "shoulders",
    "traps",
    "triceps",
)

# The filter chips on the Add exercises screen (06) are groups of muscles.
MUSCLE_GROUPS: dict[str, tuple[str, ...]] = {
    "chest": ("chest",),
    "back": ("lats", "middle back", "lower back", "traps"),
    "shoulders": ("shoulders",),
    "biceps": ("biceps",),
    "triceps": ("triceps",),
    "legs": ("quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"),
    "core": ("abdominals",),
    "forearms": ("forearms",),
    "neck": ("neck",),
}
GROUP_OF_MUSCLE = {muscle: group for group, muscles in MUSCLE_GROUPS.items() for muscle in muscles}

EQUIPMENT = (
    "barbell",
    "dumbbell",
    "cable",
    "machine",
    "kettlebells",
    "bands",
    "body only",
    "e-z curl bar",
    "medicine ball",
    "exercise ball",
    "foam roll",
    "other",
)

KINDS = ("weighted", "bodyweight")


def visible_to(user_id: uuid.UUID | None) -> ColumnElement[bool]:
    """The library plus the user's own custom exercises (just the library when signed out)."""
    if user_id is None:
        return Exercise.owner_user_id.is_(None)
    return or_(Exercise.owner_user_id.is_(None), Exercise.owner_user_id == user_id)


async def require_visible(
    session: AsyncSession, exercise_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """For rows that refer to an exercise. Soft-deleted exercises still count, so replays of
    older writes keep working."""
    found = await session.scalar(
        select(Exercise.id).where(Exercise.id == exercise_id, visible_to(user_id))
    )
    if found is None:
        raise NotFoundError


def _searchable(column: ColumnElement[str]) -> ColumnElement[str]:
    return func.lower(func.replace(column, "-", " "))


def _like_escape(text: str) -> str:
    return re.sub(r"([\\%_])", r"\\\1", text)


async def list_exercises(
    session: AsyncSession,
    user_id: uuid.UUID | None,
    *,
    q: str | None = None,
    muscle_group: str | None = None,
    equipment: str | None = None,
    kind: str | None = None,
    updated_since: datetime | None = None,
) -> list[Exercise]:
    stmt = select(Exercise).where(visible_to(user_id), pull_filter(Exercise, updated_since))
    order: list[ColumnElement[object]] = []

    words = (q or "").lower().replace("-", " ").split()
    if words:
        name = _searchable(Exercise.name)
        for word in words:
            stmt = stmt.where(name.like(f"%{_like_escape(word)}%", escape="\\"))
        phrase = _like_escape(" ".join(words))
        order.append(
            case((name == " ".join(words), 0), (name.like(f"{phrase}%", escape="\\"), 1), else_=2)
        )
    if muscle_group:
        stmt = stmt.where(Exercise.primary_muscle.in_(MUSCLE_GROUPS[muscle_group]))
    if equipment:
        stmt = stmt.where(Exercise.equipment == equipment)
    if kind:
        stmt = stmt.where(Exercise.kind == kind)

    stmt = stmt.order_by(*order, func.lower(Exercise.name), Exercise.id)
    return list(await session.scalars(stmt))
