import uuid
from datetime import date
from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, BaseModel, Field, model_validator

from app.schemas.common import Kg, KgOut, PositiveKg, SyncedOut
from app.schemas.split import Name, Position, RestSeconds

Status = Literal["planned", "done", "skipped"]
Source = Literal["split", "added", "swapped"]


class WorkoutIn(BaseModel):
    split_day_id: uuid.UUID | None = None
    title: Name
    started_at: AwareDatetime
    ended_at: AwareDatetime | None = Field(
        default=None, description="Null while in progress. Once set, a PUT can't clear it."
    )
    bodyweight_kg: PositiveKg | None = Field(
        default=None,
        description="Snapshot at start. Omitted on create: the latest bodyweight entry.",
    )

    @model_validator(mode="after")
    def _ends_after_start(self) -> Self:
        if self.ended_at is not None and self.ended_at < self.started_at:
            raise ValueError("ended_at is before started_at")
        return self


class WorkoutOut(SyncedOut):
    split_day_id: uuid.UUID | None
    title: str
    started_at: AwareDatetime
    ended_at: AwareDatetime | None
    bodyweight_kg: KgOut


class WorkoutExerciseIn(BaseModel):
    workout_id: uuid.UUID
    exercise_id: uuid.UUID
    position: Position
    status: Status = "planned"
    source: Source = "split"
    rest_seconds: RestSeconds


class WorkoutExerciseOut(SyncedOut):
    workout_id: uuid.UUID
    exercise_id: uuid.UUID
    position: int
    status: str
    source: str
    rest_seconds: int


class SetIn(BaseModel):
    workout_exercise_id: uuid.UUID
    set_number: Annotated[int, Field(ge=1, le=100)]
    weight_kg: Kg = Field(description="For bodyweight exercises, the added weight only.")
    reps: Annotated[int, Field(ge=0, le=1000)]
    logged_at: AwareDatetime


class SetOut(SyncedOut):
    workout_exercise_id: uuid.UUID
    set_number: int
    weight_kg: KgOut
    reps: int
    logged_at: AwareDatetime


class WorkoutExerciseDetail(WorkoutExerciseOut):
    sets: list[SetOut]


class WorkoutDetail(WorkoutOut):
    """A workout with its live exercises in order, each with its live sets in order."""

    exercises: list[WorkoutExerciseDetail]


class LastSessionSet(BaseModel):
    set_number: int
    weight_kg: KgOut
    reps: int


class LastSessionOut(BaseModel):
    """The ghost for one exercise: its sets in the most recent finished workout that has any."""

    exercise_id: uuid.UUID
    workout_id: uuid.UUID
    title: str
    started_at: AwareDatetime
    ended_at: AwareDatetime
    bodyweight_kg: KgOut
    sets: list[LastSessionSet]


class BodyweightIn(BaseModel):
    weight_kg: PositiveKg
    measured_on: date


class BodyweightOut(SyncedOut):
    weight_kg: KgOut
    measured_on: date
