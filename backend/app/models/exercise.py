import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, Text, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import IdMixin, TimestampMixin


class Exercise(IdMixin, TimestampMixin, Base):
    """A library exercise (`owner_user_id` is null) or a user's custom exercise."""

    __tablename__ = "exercises"
    __table_args__ = (
        # Pulls fetch the library (owner null) and the user's own exercises.
        Index("ix_exercises_owner_user_id_updated_at", "owner_user_id", "updated_at"),
        CheckConstraint("kind IN ('weighted', 'bodyweight')", name="kind"),
    )

    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    name: Mapped[str]
    primary_muscle: Mapped[str]
    secondary_muscles: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    equipment: Mapped[str | None]
    kind: Mapped[str]
