import uuid

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import AwareDatetime

from app.api.deps import CurrentUser, SessionDep
from app.models import Exercise
from app.schemas.exercise import Equipment, ExerciseIn, ExerciseOut, Kind, MuscleGroup
from app.services import exercises, sync

router = APIRouter(tags=["exercises"])


@router.get("/exercises")
async def list_exercises(
    user: CurrentUser,
    session: SessionDep,
    q: str | None = None,
    muscle_group: MuscleGroup | None = None,
    equipment: Equipment | None = None,
    kind: Kind | None = None,
    updated_since: AwareDatetime | None = None,
) -> list[ExerciseOut]:
    """The library plus the user's custom exercises. `q` matches every word of the name."""
    rows = await exercises.list_exercises(
        session,
        user.id,
        q=q,
        muscle_group=muscle_group,
        equipment=equipment,
        kind=kind,
        updated_since=updated_since,
    )
    return [ExerciseOut.model_validate(row) for row in rows]


@router.put("/exercises/{exercise_id}")
async def put_exercise(
    exercise_id: uuid.UUID, body: ExerciseIn, user: CurrentUser, session: SessionDep
) -> ExerciseOut:
    try:
        row = await sync.upsert(
            session, Exercise, exercise_id, {"owner_user_id": user.id}, body.model_dump()
        )
    except sync.NotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Exercise not found") from None
    await session.commit()
    return ExerciseOut.model_validate(row)


@router.delete("/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    exercise_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> Response:
    await sync.soft_delete(session, Exercise, exercise_id, {"owner_user_id": user.id})
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
