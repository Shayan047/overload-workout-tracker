import uuid
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from sqlalchemy import exists, func, select, update
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BodyweightEntry, Set, SplitDay, Workout, WorkoutExercise
from app.services import sync


class InProgressConflictError(Exception):
    def __init__(self, workout_id: uuid.UUID) -> None:
        self.workout_id = workout_id


class BodyweightMissingError(Exception):
    pass


async def latest_bodyweight(session: AsyncSession, user_id: uuid.UUID) -> Decimal | None:
    return await session.scalar(
        select(BodyweightEntry.weight_kg)
        .where(BodyweightEntry.user_id == user_id, BodyweightEntry.deleted_at.is_(None))
        .order_by(BodyweightEntry.measured_on.desc(), BodyweightEntry.updated_at.desc())
        .limit(1)
    )


async def _in_progress_id(
    session: AsyncSession, user_id: uuid.UUID, other_than: uuid.UUID | None = None
) -> uuid.UUID | None:
    stmt = select(Workout.id).where(
        Workout.user_id == user_id, Workout.ended_at.is_(None), Workout.deleted_at.is_(None)
    )
    if other_than is not None:
        stmt = stmt.where(Workout.id != other_than)
    return await session.scalar(stmt)


async def put_workout(
    session: AsyncSession, user_id: uuid.UUID, workout_id: uuid.UUID, values: dict[str, Any]
) -> Workout:
    """Start (no `ended_at`), edit or finish a workout.

    - `bodyweight_kg` omitted: on create, the latest bodyweight entry (rule 3: it is a
      snapshot and never follows later entries); on update, the stored value is kept.
    - A finished workout stays finished, so a replayed start can't reopen it.
    - At most one workout is in progress.
    """
    if values["split_day_id"] is not None:
        await sync.require_owned(session, SplitDay, values["split_day_id"], user_id)
    existing = await session.get(Workout, workout_id)
    if existing is not None and existing.user_id != user_id:
        raise sync.NotFoundError

    if values["bodyweight_kg"] is None:
        if existing is not None:
            del values["bodyweight_kg"]
        else:
            values["bodyweight_kg"] = await latest_bodyweight(session, user_id)
            if values["bodyweight_kg"] is None:
                raise BodyweightMissingError
    if values["ended_at"] is None and existing is not None and existing.ended_at is not None:
        values["ended_at"] = existing.ended_at

    still_open = values["ended_at"] is None and (existing is None or existing.deleted_at is None)
    if still_open and (other := await _in_progress_id(session, user_id, other_than=workout_id)):
        raise InProgressConflictError(other)
    try:
        return await sync.upsert(session, Workout, workout_id, {"user_id": user_id}, values)
    except IntegrityError:  # lost a race with another start
        await session.rollback()
        other = await _in_progress_id(session, user_id, other_than=workout_id)
        raise InProgressConflictError(other or workout_id) from None


async def delete_workout(session: AsyncSession, workout_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Soft-deletes the workout, its exercises and their sets."""
    if await sync.soft_delete(session, Workout, workout_id, {"user_id": user_id}) is None:
        return
    rows = select(WorkoutExercise.id).where(WorkoutExercise.workout_id == workout_id)
    await _delete_sets(session, rows.scalar_subquery())
    await session.execute(
        update(WorkoutExercise)
        .where(WorkoutExercise.workout_id == workout_id, WorkoutExercise.deleted_at.is_(None))
        .values(deleted_at=func.now())
    )


async def delete_workout_exercise(
    session: AsyncSession, row_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """Soft-deletes the row and its sets."""
    if await sync.soft_delete(session, WorkoutExercise, row_id, {"user_id": user_id}) is None:
        return
    await _delete_sets(session, [row_id])


async def _delete_sets(session: AsyncSession, workout_exercise_ids: object) -> None:
    await session.execute(
        update(Set)
        .where(Set.workout_exercise_id.in_(workout_exercise_ids), Set.deleted_at.is_(None))
        .values(deleted_at=func.now())
    )


@dataclass
class WorkoutTree:
    workout: Workout
    exercises: list[WorkoutExercise]
    sets: dict[uuid.UUID, list[Set]]


async def workout_tree(session: AsyncSession, workout: Workout) -> WorkoutTree:
    """The workout with its live exercises and their live sets, in order."""
    exercises = list(
        await session.scalars(
            select(WorkoutExercise)
            .where(WorkoutExercise.workout_id == workout.id, WorkoutExercise.deleted_at.is_(None))
            .order_by(WorkoutExercise.position, WorkoutExercise.created_at, WorkoutExercise.id)
        )
    )
    rows = await session.scalars(
        select(Set)
        .where(Set.workout_exercise_id.in_([e.id for e in exercises]), Set.deleted_at.is_(None))
        .order_by(Set.set_number, Set.logged_at, Set.id)
    )
    sets: dict[uuid.UUID, list[Set]] = defaultdict(list)
    for row in rows:
        sets[row.workout_exercise_id].append(row)
    return WorkoutTree(workout, exercises, sets)


async def in_progress(session: AsyncSession, user_id: uuid.UUID) -> Workout | None:
    workout_id = await _in_progress_id(session, user_id)
    return await session.get(Workout, workout_id) if workout_id else None


@dataclass
class LastSession:
    exercise_id: uuid.UUID
    workout: Workout
    sets: list[Set]


def _has_live_set() -> Any:
    return exists().where(Set.workout_exercise_id == WorkoutExercise.id, Set.deleted_at.is_(None))


async def last_sessions(
    session: AsyncSession, user_id: uuid.UUID, exercise_ids: list[uuid.UUID]
) -> list[LastSession]:
    """Rule 9 (ghost): per exercise, the most recent finished workout that contains it, with
    its sets there. "Contains" means at least one live set, so a planned-then-skipped
    exercise doesn't become the ghost."""
    latest = (
        select(WorkoutExercise.exercise_id, Workout.id.label("workout_id"))
        .join(Workout, Workout.id == WorkoutExercise.workout_id)
        .where(
            WorkoutExercise.user_id == user_id,
            WorkoutExercise.exercise_id.in_(exercise_ids),
            WorkoutExercise.deleted_at.is_(None),
            Workout.ended_at.is_not(None),
            Workout.deleted_at.is_(None),
            _has_live_set(),
        )
        .order_by(WorkoutExercise.exercise_id, Workout.ended_at.desc(), Workout.id)
        .ext(distinct_on(WorkoutExercise.exercise_id))
    )
    found = (await session.execute(latest)).all()
    results = []
    for exercise_id, workout_id in found:
        sets = await session.scalars(
            select(Set)
            .join(WorkoutExercise, WorkoutExercise.id == Set.workout_exercise_id)
            .where(
                WorkoutExercise.workout_id == workout_id,
                WorkoutExercise.exercise_id == exercise_id,
                WorkoutExercise.deleted_at.is_(None),
                Set.deleted_at.is_(None),
            )
            .order_by(WorkoutExercise.position, Set.set_number, Set.logged_at, Set.id)
        )
        workout = await session.get_one(Workout, workout_id)
        results.append(LastSession(exercise_id, workout, list(sets)))
    order = {exercise_id: i for i, exercise_id in enumerate(exercise_ids)}
    return sorted(results, key=lambda r: order[r.exercise_id])
