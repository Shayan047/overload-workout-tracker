"""History recaps (screen 18): sets per workout and how many exercises were ahead of their
previous session. Ahead means more total reps than last time, as on the summary (11)."""

from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from app.stats.types import Session


@dataclass(frozen=True)
class WorkoutRecap:
    sets: int
    ahead: int  # exercises with more total reps than their previous session
    compared: int  # exercises that had a previous session


def workout_recaps(per_exercise: Iterable[Sequence[Session]]) -> dict[object, WorkoutRecap]:
    """`per_exercise` holds each exercise's sessions (keyed by workout). Returns a recap per
    workout key."""
    sets: dict[object, int] = defaultdict(int)
    ahead: dict[object, int] = defaultdict(int)
    compared: dict[object, int] = defaultdict(int)
    for sessions in per_exercise:
        previous: Session | None = None
        for current in sorted(sessions, key=lambda s: s.at):
            sets[current.key] += len(current.sets)
            if previous is not None:
                compared[current.key] += 1
                if sum(s.reps for s in current.sets) > sum(s.reps for s in previous.sets):
                    ahead[current.key] += 1
            previous = current
    return {key: WorkoutRecap(sets[key], ahead[key], compared[key]) for key in sets}
