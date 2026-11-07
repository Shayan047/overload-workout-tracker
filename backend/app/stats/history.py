"""History recaps (screen 18): sets per workout and how many exercises were ahead of their
previous session, by the same rule as the summary (11) and the ghost on the phone (24)."""

from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from app.stats.est_max import session_est_max
from app.stats.types import Session


@dataclass(frozen=True)
class WorkoutRecap:
    sets: int
    ahead: int  # exercises ahead of their previous session (see is_ahead)
    compared: int  # exercises that had a previous session


_SAME = 0.0005  # kg; weights are stored with three decimals


def is_ahead(current: Session, previous: Session) -> bool:
    """The heaviest weight with a rep decides what's compared. The same weight: more total
    reps is ahead. A heavier weight is ahead. A lighter one: a higher est. max is ahead
    (rule 4; bodyweight exercises add each workout's own bodyweight, rule 2). Weights are as
    entered, so a bodyweight exercise compares its added weight."""
    tops = [
        max((s.weight for s in x.sets if s.reps >= 1), default=None) for x in (current, previous)
    ]
    if tops[0] is None or tops[1] is None:
        return False
    if tops[0] > tops[1] + _SAME:
        return True
    if tops[0] < tops[1] - _SAME:
        return (session_est_max(current) or 0) > (session_est_max(previous) or 0) + _SAME
    return sum(s.reps for s in current.sets) > sum(s.reps for s in previous.sets)


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
                if is_ahead(current, previous):
                    ahead[current.key] += 1
            previous = current
    return {key: WorkoutRecap(sets[key], ahead[key], compared[key]) for key in sets}
