import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import IdMixin, TimestampMixin, UserOwnedMixin, sync_index


class Workout(IdMixin, TimestampMixin, UserOwnedMixin, Base):
    __tablename__ = "workouts"
    __table_args__ = (
        sync_index("workouts"),
        # At most one in-progress workout per user (resume after restart).
        Index(
            "uq_workouts_user_id_in_progress",
            "user_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL AND deleted_at IS NULL"),
        ),
        Index("ix_workouts_user_id_started_at", "user_id", "started_at"),
        CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="ended_after_start"),
        CheckConstraint("bodyweight_kg > 0", name="bodyweight_kg"),
    )

    split_day_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("split_days.id", ondelete="SET NULL")
    )
    # Copied from the split day at start, so renaming the day never renames history.
    title: Mapped[str]
    started_at: Mapped[datetime]
    ended_at: Mapped[datetime | None]
    # Bodyweight snapshot at start (rule 3). Never updated from later bodyweight entries.
    bodyweight_kg: Mapped[Decimal]


class WorkoutExercise(IdMixin, TimestampMixin, UserOwnedMixin, Base):
    """An exercise in one workout. Today-only changes live here and never touch the split."""

    __tablename__ = "workout_exercises"
    __table_args__ = (
        sync_index("workout_exercises"),
        # Ghost: the latest finished workout containing this exercise.
        Index("ix_workout_exercises_user_id_exercise_id", "user_id", "exercise_id"),
        CheckConstraint("status IN ('planned', 'done', 'skipped')", name="status"),
        CheckConstraint("source IN ('split', 'added', 'swapped')", name="source"),
        CheckConstraint("position >= 0", name="position"),
        CheckConstraint("rest_seconds >= 0", name="rest_seconds"),
    )

    workout_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workouts.id", ondelete="CASCADE"), index=True
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exercises.id"))
    position: Mapped[int]
    status: Mapped[str] = mapped_column(server_default="planned")
    source: Mapped[str] = mapped_column(server_default="split")
    # Configured rest length for this workout: copied from the split, or chosen when the
    # exercise is added or swapped. Actual rest durations are never stored (rule 5).
    rest_seconds: Mapped[int]


class Set(IdMixin, TimestampMixin, UserOwnedMixin, Base):
    """A working set. For bodyweight exercises `weight_kg` is the added weight only (rule 2)."""

    __tablename__ = "sets"
    __table_args__ = (
        sync_index("sets"),
        CheckConstraint("set_number >= 1", name="set_number"),
        CheckConstraint("reps >= 0", name="reps"),
        CheckConstraint("weight_kg >= 0", name="weight_kg"),
    )

    workout_exercise_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workout_exercises.id", ondelete="CASCADE"), index=True
    )
    set_number: Mapped[int]
    weight_kg: Mapped[Decimal]
    reps: Mapped[int]
    logged_at: Mapped[datetime]
