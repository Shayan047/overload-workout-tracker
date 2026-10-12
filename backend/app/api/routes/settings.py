from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser, SessionDep
from app.api.errors import not_found_as_404
from app.models import Split, UserSettings
from app.schemas.settings import SettingsIn, SettingsOut
from app.services import sync

router = APIRouter(tags=["settings"])


async def _settings(session: SessionDep, user: CurrentUser) -> UserSettings:
    settings = await session.scalar(select(UserSettings).where(UserSettings.user_id == user.id))
    if settings is None:  # created at sign-up; this only covers older accounts
        settings = UserSettings(user_id=user.id)
        session.add(settings)
        await session.flush()
        await session.refresh(settings)
    return settings


@router.get("/settings")
async def get_settings(user: CurrentUser, session: SessionDep) -> SettingsOut:
    return SettingsOut.model_validate(await _settings(session, user))


@router.put("/settings")
async def put_settings(body: SettingsIn, user: CurrentUser, session: SessionDep) -> SettingsOut:
    """The whole settings object. Last write wins, like every other row."""
    settings = await _settings(session, user)
    if body.active_split_id is not None:
        with not_found_as_404("Split"):
            await sync.require_owned(session, Split, body.active_split_id, user.id)
    for column, value in body.model_dump().items():
        if getattr(settings, column) != value:
            setattr(settings, column, value)
    await session.flush()
    await session.refresh(settings)
    await session.commit()
    return SettingsOut.model_validate(settings)
