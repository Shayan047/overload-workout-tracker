import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, computed_field

from app.schemas.common import SyncedOut
from app.services.exercises import EQUIPMENT, GROUP_OF_MUSCLE, KINDS, MUSCLE_GROUPS, MUSCLES

Muscle = Literal[*MUSCLES]
MuscleGroup = Literal[*MUSCLE_GROUPS]
Equipment = Literal[*EQUIPMENT]
Kind = Literal[*KINDS]


class ExerciseIn(BaseModel):
    """A custom exercise. Library exercises are read-only."""

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    primary_muscle: Muscle
    secondary_muscles: Annotated[list[Muscle], Field(max_length=len(MUSCLES))] = []
    equipment: Equipment | None = None
    kind: Kind


class ExerciseOut(SyncedOut):
    name: str
    primary_muscle: str
    secondary_muscles: list[str]
    equipment: str | None
    kind: str
    owner_user_id: uuid.UUID | None = Field(exclude=True)

    @computed_field
    def muscle_group(self) -> str:
        return GROUP_OF_MUSCLE[self.primary_muscle]

    @computed_field
    def is_custom(self) -> bool:
        return self.owner_user_id is not None
