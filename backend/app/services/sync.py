"""Write and pull rules shared by every synced resource (see docs/api-and-sync.md).

- PUT is an upsert by the client's id. Values equal to what is stored are left alone, so a
  replayed PUT changes nothing, not even `updated_at`.
- Deleted is final: a PUT to a soft-deleted row is a no-op that returns the tombstone.
- DELETE is idempotent and silent about ids it does not know.
- Rows owned by someone else are reported as not found.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ColumnElement, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base


class NotFoundError(Exception):
    """The row, or a row it refers to, does not exist for this user."""


def _owned(row: Any, owner: dict[str, uuid.UUID | None]) -> bool:
    return all(getattr(row, column) == value for column, value in owner.items())


async def upsert[M: Base](
    session: AsyncSession,
    model: type[M],
    row_id: uuid.UUID,
    owner: dict[str, uuid.UUID | None],
    values: dict[str, Any],
) -> M:
    row = await session.get(model, row_id)
    if row is None:
        row = model(id=row_id, **owner, **values)
        session.add(row)
    elif not _owned(row, owner):
        raise NotFoundError
    elif row.deleted_at is None:  # type: ignore[attr-defined]
        for column, value in values.items():
            if getattr(row, column) != value:
                setattr(row, column, value)
    await session.flush()
    await session.refresh(row)  # server-set timestamps
    return row


async def soft_delete[M: Base](
    session: AsyncSession, model: type[M], row_id: uuid.UUID, owner: dict[str, uuid.UUID | None]
) -> None:
    row = await session.get(model, row_id)
    if row is None or not _owned(row, owner) or row.deleted_at is not None:  # type: ignore[attr-defined]
        return
    row.deleted_at = func.now()  # type: ignore[attr-defined]
    await session.flush()


def pull_filter(model: Any, updated_since: datetime | None) -> ColumnElement[bool]:
    """Full pulls return live rows; incremental pulls return every changed row, tombstones too."""
    if updated_since is None:
        return model.deleted_at.is_(None)
    return model.updated_at > updated_since
