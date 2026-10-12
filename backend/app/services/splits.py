import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Split, SplitDay, SplitDayExercise, UserSettings, Workout
from app.seed.exercises import library_exercise_id
from app.services import sync
from app.services.presets import Preset


@dataclass(frozen=True)
class DayRef:
    id: uuid.UUID
    position: int
    created_at: datetime
    weekday: int | None
    deleted: bool

    @property
    def order(self) -> tuple[int, datetime, uuid.UUID]:
        return (self.position, self.created_at, self.id)


def next_day(
    days: list[DayRef], repeat_mode: str, last_done: uuid.UUID | None, on: date
) -> uuid.UUID | None:
    """The split day to train on `on`, or None for a rest day (or a split with no days).

    - "weekdays": the day set to `on`'s weekday (0 = Monday). History doesn't matter.
    - "in_order": the day after `last_done` (the day of the most recent finished workout for
      this split), wrapping around. The calendar doesn't matter, so rest days never shift
      it. `days` must include deleted days, so a deleted `last_done` still has a place.
    """
    live = sorted((d for d in days if not d.deleted), key=lambda d: d.order)
    if not live:
        return None
    if repeat_mode == "weekdays":
        return next((d.id for d in live if d.weekday == on.weekday()), None)

    last = next((d for d in days if d.id == last_done), None)
    if last is None:
        return live[0].id
    return next((d.id for d in live if d.order > last.order), live[0].id)


async def require_split(session: AsyncSession, split_id: uuid.UUID, user_id: uuid.UUID) -> Split:
    split = await session.get(Split, split_id)
    if split is None or split.user_id != user_id:
        raise sync.NotFoundError
    return split


async def next_day_for(session: AsyncSession, split: Split, on: date) -> SplitDay | None:
    days = list(await session.scalars(select(SplitDay).where(SplitDay.split_id == split.id)))
    last_done = await session.scalar(
        select(Workout.split_day_id)
        .join(SplitDay, SplitDay.id == Workout.split_day_id)
        .where(
            SplitDay.split_id == split.id,
            Workout.user_id == split.user_id,
            Workout.ended_at.is_not(None),
            Workout.deleted_at.is_(None),
        )
        .order_by(Workout.ended_at.desc())
        .limit(1)
    )
    refs = [
        DayRef(d.id, d.position, d.created_at, d.weekday, d.deleted_at is not None) for d in days
    ]
    chosen = next_day(refs, split.repeat_mode, last_done, on)
    return next((d for d in days if d.id == chosen), None)


def preset_day_id(split_id: uuid.UUID, day: int) -> uuid.UUID:
    return uuid.uuid5(split_id, f"day:{day}")


def preset_exercise_id(split_id: uuid.UUID, day: int, exercise: int) -> uuid.UUID:
    return uuid.uuid5(split_id, f"day:{day}:exercise:{exercise}")


async def create_from_preset(
    session: AsyncSession, user_id: uuid.UUID, split_id: uuid.UUID, preset: Preset
) -> None:
    """Copies a preset into the user's rows. Child ids are derived from `split_id`, so the
    phone can compute them offline and a replay creates nothing. If the split already
    exists this does nothing."""
    existing = await session.get(Split, split_id)
    if existing is not None:
        if existing.user_id != user_id:
            raise sync.NotFoundError
        return
    session.add(
        Split(id=split_id, user_id=user_id, name=preset.name, repeat_mode=preset.repeat_mode)
    )
    await session.flush()
    for i, day in enumerate(preset.days):
        session.add(
            SplitDay(
                id=preset_day_id(split_id, i),
                user_id=user_id,
                split_id=split_id,
                name=day.name,
                position=i,
                weekday=day.weekday,
            )
        )
    await session.flush()
    for i, day in enumerate(preset.days):
        for j, exercise in enumerate(day.exercises):
            session.add(
                SplitDayExercise(
                    id=preset_exercise_id(split_id, i, j),
                    user_id=user_id,
                    split_day_id=preset_day_id(split_id, i),
                    exercise_id=library_exercise_id(exercise.source_id),
                    position=j,
                    rest_seconds=exercise.rest_seconds,
                )
            )
    await session.flush()


@dataclass
class SplitTree:
    split: Split
    days: list[SplitDay]
    exercises: dict[uuid.UUID, list[SplitDayExercise]]


async def split_tree(session: AsyncSession, split: Split) -> SplitTree:
    """The split with its live days and their live exercises, in order."""
    days = list(
        await session.scalars(
            select(SplitDay)
            .where(SplitDay.split_id == split.id, SplitDay.deleted_at.is_(None))
            .order_by(SplitDay.position, SplitDay.created_at, SplitDay.id)
        )
    )
    rows = await session.scalars(
        select(SplitDayExercise)
        .where(
            SplitDayExercise.split_day_id.in_([d.id for d in days]),
            SplitDayExercise.deleted_at.is_(None),
        )
        .order_by(SplitDayExercise.position, SplitDayExercise.created_at, SplitDayExercise.id)
    )
    exercises: dict[uuid.UUID, list[SplitDayExercise]] = defaultdict(list)
    for row in rows:
        exercises[row.split_day_id].append(row)
    return SplitTree(split, days, exercises)


async def _delete_day_exercises(session: AsyncSession, day_ids: object) -> None:
    await session.execute(
        update(SplitDayExercise)
        .where(SplitDayExercise.split_day_id.in_(day_ids), SplitDayExercise.deleted_at.is_(None))
        .values(deleted_at=func.now())
    )


async def delete_split(session: AsyncSession, split_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Soft-deletes the split, its days and their exercises, and clears it as active split."""
    if await sync.soft_delete(session, Split, split_id, {"user_id": user_id}) is None:
        return
    day_ids = select(SplitDay.id).where(SplitDay.split_id == split_id).scalar_subquery()
    await _delete_day_exercises(session, day_ids)
    await session.execute(
        update(SplitDay)
        .where(SplitDay.split_id == split_id, SplitDay.deleted_at.is_(None))
        .values(deleted_at=func.now())
    )
    await session.execute(
        update(UserSettings)
        .where(UserSettings.user_id == user_id, UserSettings.active_split_id == split_id)
        .values(active_split_id=None)
    )


async def delete_split_day(session: AsyncSession, day_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Soft-deletes the day and its exercises."""
    if await sync.soft_delete(session, SplitDay, day_id, {"user_id": user_id}) is None:
        return
    await _delete_day_exercises(session, [day_id])
