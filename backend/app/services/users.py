from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.security import burn_password_check, hash_password, verify_password
from app.models import User, UserSettings


class EmailTakenError(Exception):
    pass


async def _find_by_email(session: AsyncSession, email: str) -> User | None:
    # lower(email) matches the unique index, so this is an index lookup.
    return await session.scalar(select(User).where(func.lower(User.email) == email.lower()))


async def create_user(
    session: AsyncSession, email: str, password: str, display_name: str | None
) -> User:
    """Creates the user and their settings row. `email` must already be normalized."""
    if await _find_by_email(session, email) is not None:
        raise EmailTakenError
    # Argon2 is deliberately slow; keep it off the event loop.
    password_hash = await run_in_threadpool(hash_password, password)
    user = User(email=email, password_hash=password_hash, display_name=display_name)
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:  # lost a race with an identical sign-up
        await session.rollback()
        raise EmailTakenError from exc
    session.add(UserSettings(user_id=user.id))
    await session.commit()
    return user


async def authenticate(session: AsyncSession, email: str, password: str) -> User | None:
    user = await _find_by_email(session, email)
    if user is None or user.deleted_at is not None:
        await run_in_threadpool(burn_password_check, password)
        return None
    valid, new_hash = await run_in_threadpool(verify_password, password, user.password_hash)
    if not valid:
        return None
    if new_hash is not None:
        user.password_hash = new_hash
        await session.commit()
    return user
