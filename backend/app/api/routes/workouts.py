import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import AwareDatetime
from sqlalchemy import select

from app.api.deps import CurrentUser, SessionDep
from app.api.errors import not_found_as_404
from app.models import Set, Workout, WorkoutExercise
from app.schemas.workout import (
    LastSessionOut,
    LastSessionSet,
    SetIn,
    SetOut,
    WorkoutDetail,
    WorkoutExerciseDetail,
    WorkoutExerciseIn,
    WorkoutExerciseOut,
    WorkoutHistoryOut,
    WorkoutIn,
    WorkoutOut,
)
from app.services import exercises, sync, workouts
from app.services import stats as stats_service
from app.stats import session_est_max, workout_recaps

router = APIRouter(tags=["workouts"])


async def _detail(session: SessionDep, workout: Workout) -> WorkoutDetail:
    tree = await workouts.workout_tree(session, workout)
    return WorkoutDetail(
        **WorkoutOut.model_validate(workout).model_dump(),
        exercises=[
            WorkoutExerciseDetail(
                **WorkoutExerciseOut.model_validate(row).model_dump(),
                sets=[SetOut.model_validate(s) for s in tree.sets[row.id]],
            )
            for row in tree.exercises
        ],
    )


# Workouts


@router.get("/workouts")
async def list_workouts(
    user: CurrentUser, session: SessionDep, updated_since: AwareDatetime | None = None
) -> list[WorkoutOut]:
    rows = await session.scalars(
        select(Workout)
        .where(Workout.user_id == user.id, sync.pull_filter(Workout, updated_since))
        .order_by(Workout.started_at, Workout.id)
    )
    return [WorkoutOut.model_validate(row) for row in rows]


@router.get("/workouts/history")
async def workout_history(user: CurrentUser, session: SessionDep) -> list[WorkoutHistoryOut]:
    """Finished workouts, newest first, each with its set count and how many exercises beat
    their previous session's total reps (History, 18)."""
    rows = await session.scalars(
        select(Workout)
        .where(
            Workout.user_id == user.id, Workout.ended_at.is_not(None), Workout.deleted_at.is_(None)
        )
        .order_by(Workout.started_at.desc(), Workout.id)
    )
    by_exercise = await stats_service.sessions_by_exercise(session, user.id)
    recaps = workout_recaps(sessions for _, sessions in by_exercise.values())
    result = []
    for row in rows:
        recap = recaps.get(row.id)
        result.append(
            WorkoutHistoryOut(
                **WorkoutOut.model_validate(row).model_dump(),
                sets=recap.sets if recap else 0,
                ahead=recap.ahead if recap else 0,
                compared=recap.compared if recap else 0,
            )
        )
    return result


@router.get("/workouts/in-progress")
async def get_in_progress(user: CurrentUser, session: SessionDep) -> WorkoutDetail | None:
    """The unfinished workout to resume, with its exercises and sets, or null."""
    workout = await workouts.in_progress(session, user.id)
    return await _detail(session, workout) if workout else None


@router.get("/workouts/last-sessions")
async def get_last_sessions(
    user: CurrentUser,
    session: SessionDep,
    exercise_id: Annotated[list[uuid.UUID], Query(max_length=100)],
) -> list[LastSessionOut]:
    """Last time (ghost) for each exercise: its sets in the most recent finished workout
    that has any. Exercises never done are left out."""
    found = await workouts.last_sessions(session, user.id, exercise_id)
    history = await stats_service.sessions_by_exercise(session, user.id) if found else {}

    def best_est_max(ex_id: uuid.UUID) -> float | None:
        sessions = history[ex_id][1] if ex_id in history else []
        values = [v for s in sessions if (v := session_est_max(s)) is not None]
        return round(max(values), 3) if values else None

    return [
        LastSessionOut(
            exercise_id=last.exercise_id,
            workout_id=last.workout.id,
            title=last.workout.title,
            started_at=last.workout.started_at,
            ended_at=last.workout.ended_at,  # type: ignore[arg-type]  # finished workouts only
            bodyweight_kg=last.workout.bodyweight_kg,
            sets=[LastSessionSet.model_validate(s, from_attributes=True) for s in last.sets],
            best_est_max_kg=best_est_max(last.exercise_id),
        )
        for last in found
    ]


@router.get("/workouts/{workout_id}")
async def get_workout(
    workout_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> WorkoutDetail:
    with not_found_as_404("Workout"):
        workout = await sync.require_owned(session, Workout, workout_id, user.id)
        if workout.deleted_at is not None:
            raise sync.NotFoundError
    return await _detail(session, workout)


@router.put("/workouts/{workout_id}")
async def put_workout(
    workout_id: uuid.UUID, body: WorkoutIn, user: CurrentUser, session: SessionDep
) -> WorkoutOut:
    """Start (no `ended_at`), edit, or finish (with `ended_at`) a workout."""
    with not_found_as_404("Workout"):
        try:
            row = await workouts.put_workout(session, user.id, workout_id, body.model_dump())
        except workouts.BodyweightMissingError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Send bodyweight_kg or log a bodyweight entry first",
            ) from None
        except workouts.InProgressConflictError as conflict:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail={
                    "message": "Another workout is in progress",
                    "in_progress_workout_id": str(conflict.workout_id),
                },
            ) from None
    await session.commit()
    return WorkoutOut.model_validate(row)


@router.delete("/workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout(workout_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    """Also deletes its exercises and their sets."""
    await workouts.delete_workout(session, workout_id, user.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Workout exercises (today-only changes are PUTs here; they never touch the split)


@router.get("/workout-exercises")
async def list_workout_exercises(
    user: CurrentUser, session: SessionDep, updated_since: AwareDatetime | None = None
) -> list[WorkoutExerciseOut]:
    rows = await session.scalars(
        select(WorkoutExercise)
        .where(WorkoutExercise.user_id == user.id, sync.pull_filter(WorkoutExercise, updated_since))
        .order_by(
            WorkoutExercise.workout_id,
            WorkoutExercise.position,
            WorkoutExercise.created_at,
            WorkoutExercise.id,
        )
    )
    return [WorkoutExerciseOut.model_validate(row) for row in rows]


@router.put("/workout-exercises/{row_id}")
async def put_workout_exercise(
    row_id: uuid.UUID, body: WorkoutExerciseIn, user: CurrentUser, session: SessionDep
) -> WorkoutExerciseOut:
    with not_found_as_404("Workout exercise"):
        await sync.require_owned(session, Workout, body.workout_id, user.id)
        await exercises.require_visible(session, body.exercise_id, user.id)
        row = await sync.upsert(
            session, WorkoutExercise, row_id, {"user_id": user.id}, body.model_dump()
        )
    await session.commit()
    return WorkoutExerciseOut.model_validate(row)


@router.delete("/workout-exercises/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout_exercise(
    row_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> Response:
    """Also deletes its sets."""
    await workouts.delete_workout_exercise(session, row_id, user.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Sets


@router.get("/sets")
async def list_sets(
    user: CurrentUser, session: SessionDep, updated_since: AwareDatetime | None = None
) -> list[SetOut]:
    rows = await session.scalars(
        select(Set)
        .where(Set.user_id == user.id, sync.pull_filter(Set, updated_since))
        .order_by(Set.workout_exercise_id, Set.set_number, Set.logged_at, Set.id)
    )
    return [SetOut.model_validate(row) for row in rows]


@router.put("/sets/{set_id}")
async def put_set(set_id: uuid.UUID, body: SetIn, user: CurrentUser, session: SessionDep) -> SetOut:
    with not_found_as_404("Set"):
        await sync.require_owned(session, WorkoutExercise, body.workout_exercise_id, user.id)
        row = await sync.upsert(session, Set, set_id, {"user_id": user.id}, body.model_dump())
    await session.commit()
    return SetOut.model_validate(row)


@router.delete("/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_set(set_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    await sync.soft_delete(session, Set, set_id, {"user_id": user.id})
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
