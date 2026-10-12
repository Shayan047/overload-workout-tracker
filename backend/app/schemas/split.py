import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.common import SyncedOut
from app.services.presets import PRESETS

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
RepeatMode = Literal["in_order", "weekdays"]
Position = Annotated[int, Field(ge=0, le=10_000)]
RestSeconds = Annotated[int, Field(ge=0, le=3600)]
Weekday = Annotated[int, Field(ge=0, le=6, description="0 = Monday … 6 = Sunday")]
PresetKey = Literal[*PRESETS]


class SplitIn(BaseModel):
    name: Name
    repeat_mode: RepeatMode


class SplitOut(SyncedOut):
    name: str
    repeat_mode: str


class SplitDayIn(BaseModel):
    split_id: uuid.UUID
    name: Name
    position: Position
    weekday: Weekday | None = None


class SplitDayOut(SyncedOut):
    split_id: uuid.UUID
    name: str
    position: int
    weekday: int | None


class SplitDayExerciseIn(BaseModel):
    split_day_id: uuid.UUID
    exercise_id: uuid.UUID
    position: Position
    rest_seconds: RestSeconds


class SplitDayExerciseOut(SyncedOut):
    split_day_id: uuid.UUID
    exercise_id: uuid.UUID
    position: int
    rest_seconds: int


class SplitDayDetail(SplitDayOut):
    exercises: list[SplitDayExerciseOut]


class SplitDetail(SplitOut):
    """A split with its live days and exercises, in order."""

    days: list[SplitDayDetail]


class FromPresetIn(BaseModel):
    preset: PresetKey


class NextDayOut(BaseModel):
    split_id: uuid.UUID
    day: SplitDayOut | None = Field(description="Null on a rest day or when the split has no days")


class PresetExerciseOut(BaseModel):
    exercise_id: uuid.UUID
    rest_seconds: int


class PresetDayOut(BaseModel):
    name: str
    weekday: int | None
    exercises: list[PresetExerciseOut]


class PresetOut(BaseModel):
    key: str
    name: str
    summary: str
    repeat_mode: str
    days: list[PresetDayOut]
