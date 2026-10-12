from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class LoggedSet:
    weight: float  # as entered; for bodyweight exercises, the added weight only
    reps: int


@dataclass(frozen=True)
class Session:
    """One exercise's sets in one finished workout, in the order they were done."""

    at: datetime
    sets: tuple[LoggedSet, ...]
    # The workout's bodyweight snapshot for bodyweight exercises, else 0. Added to each set's
    # weight to get the load used for est. max (rule 2).
    bodyweight: float = 0.0
    key: object = None  # caller's id for the session (e.g. the workout id)
