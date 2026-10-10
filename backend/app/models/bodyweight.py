from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Index
from sqlalchemy.orm import Mapped

from app.db.base import Base
from app.models.mixins import IdMixin, TimestampMixin, UserOwnedMixin, sync_index


class BodyweightEntry(IdMixin, TimestampMixin, UserOwnedMixin, Base):
    __tablename__ = "bodyweight_entries"
    __table_args__ = (
        sync_index("bodyweight_entries"),
        Index("ix_bodyweight_entries_user_id_measured_on", "user_id", "measured_on"),
        CheckConstraint("weight_kg > 0", name="weight_kg"),
    )

    weight_kg: Mapped[Decimal]
    measured_on: Mapped[date]
