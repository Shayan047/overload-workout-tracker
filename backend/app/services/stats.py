"""Loads finished sessions from the database for the pure functions in app/stats."""

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Exercise, Set, Workout, WorkoutExercise
from app.services import sync
from app.services.exercises import visible_to
from app.stats import LoggedSet, Session


@dataclass
class _Draft:
    at: datetime
    bodyweight: float
    sets: list[LoggedSet] = field(default_factory=list)


async def require_exercise(
    session: AsyncSession, exercise_id: uuid.UUID, user_id: uuid.UUID
) -> Exercise:
    exercise = await session.scalar(
        select(Exercise).where(Exercise.id == exercise_id, visible_to(user_id))
    )
    if exercise is None:
        raise sync.NotFoundError
    return exercise


async def sessions_by_exercise(
    session: AsyncSession, user_id: uuid.UUID, exercise_id: uuid.UUID | None = None
) -> dict[uuid.UUID, tuple[Exercise, list[Session]]]:
    """Every finished, non-deleted workout's live sets, grouped per exercise and workout,
    oldest first. Bodyweight exercises carry the workout's bodyweight snapshot."""
    stmt = (
        select(
            Exercise, Workout.id, Workout.started_at, Workout.bodyweight_kg, Set.weight_kg, Set.reps
        )
        .select_from(Set)
        .join(WorkoutExercise, WorkoutExercise.id == Set.workout_exercise_id)
        .join(Workout, Workout.id == WorkoutExercise.workout_id)
        .join(Exercise, Exercise.id == WorkoutExercise.exercise_id)
        .where(
            Workout.user_id == user_id,
            Workout.ended_at.is_not(None),
            Workout.deleted_at.is_(None),
            WorkoutExercise.deleted_at.is_(None),
            Set.deleted_at.is_(None),
        )
        .order_by(
            Workout.started_at,
            Workout.id,
            WorkoutExercise.position,
            WorkoutExercise.created_at,
            Set.set_number,
            Set.logged_at,
            Set.id,
        )
    )
    if exercise_id is not None:
        stmt = stmt.where(WorkoutExercise.exercise_id == exercise_id)

    exercises: dict[uuid.UUID, Exercise] = {}
    grouped: dict[uuid.UUID, dict[uuid.UUID, _Draft]] = defaultdict(dict)
    for exercise, workout_id, started_at, bodyweight, weight, reps in await session.execute(stmt):
        exercises[exercise.id] = exercise
        draft = grouped[exercise.id].setdefault(
            workout_id,
            _Draft(started_at, float(bodyweight) if exercise.kind == "bodyweight" else 0.0),
        )
        draft.sets.append(LoggedSet(float(weight), reps))

    return {
        ex_id: (
            exercises[ex_id],
            [
                Session(at=d.at, sets=tuple(d.sets), bodyweight=d.bodyweight, key=workout_id)
                for workout_id, d in drafts.items()
            ],
        )
        for ex_id, drafts in grouped.items()
    }
