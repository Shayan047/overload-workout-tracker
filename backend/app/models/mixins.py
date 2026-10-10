import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, func
from sqlalchemy.orm import Mapped, declared_attr, mapped_column


class IdMixin:
    """UUID primary key. The phone usually supplies it; the default covers server-made rows."""

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    """`created_at`, `updated_at` (last write wins by this) and `deleted_at` (soft delete)."""

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None]


class UserOwnedMixin:
    """`user_id` on every user-owned row, child rows included, so every query and every
    `updated_since` pull is a plain filter on the user. Add `sync_index(...)` to the table."""

    @declared_attr
    def user_id(cls) -> Mapped[uuid.UUID]:
        return mapped_column(ForeignKey("users.id", ondelete="CASCADE"))


def sync_index(table: str) -> Index:
    """Serves `updated_since` pulls (user first, then time). Also covers lookups by user."""
    return Index(f"ix_{table}_user_id_updated_at", "user_id", "updated_at")
