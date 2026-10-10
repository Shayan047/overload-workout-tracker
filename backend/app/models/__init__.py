"""All models, imported here so `Base.metadata` is complete for Alembic and tests."""

from app.models.bodyweight import BodyweightEntry
from app.models.exercise import Exercise
from app.models.split import Split, SplitDay, SplitDayExercise
from app.models.user import User, UserSettings
from app.models.workout import Set, Workout, WorkoutExercise

__all__ = [
    "BodyweightEntry",
    "Exercise",
    "Set",
    "Split",
    "SplitDay",
    "SplitDayExercise",
    "User",
    "UserSettings",
    "Workout",
    "WorkoutExercise",
]
