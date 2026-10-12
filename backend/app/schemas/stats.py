"""Stats responses. Weights and est. max are in kg (est. max rounded to the gram); the phone
converts and rounds for display."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SetOut(BaseModel):
    weight_kg: float = Field(description="As entered; added weight for bodyweight exercises")
    reps: int


class DatedSetOut(SetOut):
    at: datetime


class EstMaxPointOut(BaseModel):
    at: datetime
    est_max_kg: float


class SessionOut(EstMaxPointOut):
    workout_id: uuid.UUID
    best_set: SetOut
    sets: list[SetOut]


class WeightUseOut(BaseModel):
    weight_kg: float
    sessions: int
    first_at: datetime


class HeaviestOut(BaseModel):
    weight_kg: float
    first_at: datetime


class PlateauOut(BaseModel):
    weeks_flat: int
    best_kg: float
    best_at: datetime


class ProjectionOut(BaseModel):
    at: datetime
    est_max_kg: float
    weekly_gain_kg: float
    capped: bool = Field(description="The trend was steeper than the 1.5%-a-week cap")


class FrontierPointOut(BaseModel):
    weight_kg: float
    reps: int
    at: datetime = Field(description="When these reps were first reached at this weight")


class ExerciseStatsOut(BaseModel):
    exercise_id: uuid.UUID
    includes_bodyweight: bool = Field(description="Est. max uses bodyweight + added weight")
    est_max_kg: float | None
    latest_at: datetime | None
    first: EstMaxPointOut | None
    is_new_best: bool
    series: list[SessionOut] = Field(description="Every session, oldest first")
    weights: list[WeightUseOut]
    best_set: DatedSetOut | None
    most_reps: DatedSetOut | None
    heaviest: HeaviestOut | None
    plateau: PlateauOut | None
    projection: ProjectionOut | None
    frontier: list[FrontierPointOut]


class WeightSessionOut(BaseModel):
    workout_id: uuid.UUID
    at: datetime
    reps: list[int]
    total: int
    average: float
    retention: float | None = Field(description="Last set's reps ÷ first set's (0.79 = 79%)")


class OneWeightStatsOut(BaseModel):
    exercise_id: uuid.UUID
    weight_kg: float
    sessions: list[WeightSessionOut]
    total_change: int | None = Field(description="Latest session's total reps minus the first's")
    first_retention: float | None
    latest_retention: float | None
    moved_up_on: datetime | None = Field(description="When a heavier weight was first used")


class FrontierOut(BaseModel):
    exercise_id: uuid.UUID
    as_of: datetime | None
    points: list[FrontierPointOut]


class ProgressItemOut(BaseModel):
    exercise_id: uuid.UUID
    includes_bodyweight: bool
    sessions: int
    latest_at: datetime
    est_max_kg: float
    change: float | None = Field(description="Latest vs the first session in the window")
    is_new_best: bool
    plateau: PlateauOut | None
    sparkline: list[EstMaxPointOut] = Field(description="Sessions in the window")
