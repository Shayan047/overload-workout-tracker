import uuid

from fastapi import APIRouter, Response, status
from pydantic import AwareDatetime
from sqlalchemy import select

from app.api.deps import CurrentUser, SessionDep
from app.api.errors import not_found_as_404
from app.models import BodyweightEntry
from app.schemas.workout import BodyweightIn, BodyweightOut
from app.services import sync

router = APIRouter(tags=["bodyweight"])


@router.get("/bodyweight-entries")
async def list_bodyweight_entries(
    user: CurrentUser, session: SessionDep, updated_since: AwareDatetime | None = None
) -> list[BodyweightOut]:
    rows = await session.scalars(
        select(BodyweightEntry)
        .where(BodyweightEntry.user_id == user.id, sync.pull_filter(BodyweightEntry, updated_since))
        .order_by(BodyweightEntry.measured_on, BodyweightEntry.updated_at, BodyweightEntry.id)
    )
    return [BodyweightOut.model_validate(row) for row in rows]


@router.put("/bodyweight-entries/{entry_id}")
async def put_bodyweight_entry(
    entry_id: uuid.UUID, body: BodyweightIn, user: CurrentUser, session: SessionDep
) -> BodyweightOut:
    """Logging bodyweight never changes past workouts; each keeps its own snapshot."""
    with not_found_as_404("Bodyweight entry"):
        row = await sync.upsert(
            session, BodyweightEntry, entry_id, {"user_id": user.id}, body.model_dump()
        )
    await session.commit()
    return BodyweightOut.model_validate(row)


@router.delete("/bodyweight-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bodyweight_entry(
    entry_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> Response:
    await sync.soft_delete(session, BodyweightEntry, entry_id, {"user_id": user.id})
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
