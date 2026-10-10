import uuid

from sqlalchemy import CheckConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import IdMixin, TimestampMixin, UserOwnedMixin, sync_index


class Split(IdMixin, TimestampMixin, UserOwnedMixin, Base):
    __tablename__ = "splits"
    __table_args__ = (
        sync_index("splits"),
        CheckConstraint("repeat_mode IN ('in_order', 'weekdays')", name="repeat_mode"),
    )

    name: Mapped[str]
    repeat_mode: Mapped[str]


class SplitDay(IdMixin, TimestampMixin, UserOwnedMixin, Base):
    __tablename__ = "split_days"
    __table_args__ = (
        sync_index("split_days"),
        CheckConstraint("position >= 0", name="position"),
        CheckConstraint("weekday BETWEEN 0 AND 6", name="weekday"),
    )

    split_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("splits.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str]
    position: Mapped[int]
    # 0 = Monday ... 6 = Sunday. Only used when the split repeats on set weekdays.
    weekday: Mapped[int | None]


class SplitDayExercise(IdMixin, TimestampMixin, UserOwnedMixin, Base):
    __tablename__ = "split_day_exercises"
    __table_args__ = (
        sync_index("split_day_exercises"),
        CheckConstraint("position >= 0", name="position"),
        CheckConstraint("rest_seconds >= 0", name="rest_seconds"),
    )

    split_day_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("split_days.id", ondelete="CASCADE"), index=True
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exercises.id"))
    position: Mapped[int]
    rest_seconds: Mapped[int]
