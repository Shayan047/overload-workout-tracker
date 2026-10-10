import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import IdMixin, TimestampMixin


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (Index("uq_users_email_lower", func.lower(text("email")), unique=True),)

    email: Mapped[str]
    password_hash: Mapped[str]
    display_name: Mapped[str | None]


class UserSettings(IdMixin, TimestampMixin, Base):
    """Settings the phone edits (onboarding and Profile). One row per user."""

    __tablename__ = "user_settings"
    __table_args__ = (CheckConstraint("unit IN ('lb', 'kg')", name="unit"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    unit: Mapped[str] = mapped_column(server_default="lb")
    active_split_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("splits.id", ondelete="SET NULL")
    )
    ghost_mode: Mapped[bool] = mapped_column(server_default=text("true"))
    sync_wifi_only: Mapped[bool] = mapped_column(server_default=text("true"))
    rest_alert_sound: Mapped[bool] = mapped_column(server_default=text("true"))
