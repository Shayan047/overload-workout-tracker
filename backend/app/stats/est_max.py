"""Est. max (rule 4) and the records shown on Exercise detail."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from app.stats.types import LoggedSet, Session


def epley(weight: float, reps: int) -> float:
    """Est. max = weight × (1 + reps ÷ 30)."""
    return weight * (1 + reps / 30)


def _counts(s: LoggedSet) -> bool:
    return s.reps >= 1  # a 0-rep set is a failed attempt, not a lift


def set_est_max(session: Session, s: LoggedSet) -> float:
    return epley(session.bodyweight + s.weight, s.reps)


def best_set(session: Session) -> LoggedSet | None:
    """The set with the highest est. max (the first one on ties)."""
    counted = [s for s in session.sets if _counts(s)]
    return max(counted, key=lambda s: set_est_max(session, s), default=None)


def session_est_max(session: Session) -> float | None:
    """A session's est. max comes from its best set."""
    best = best_set(session)
    return set_est_max(session, best) if best else None


@dataclass(frozen=True)
class EstMaxPoint:
    at: datetime
    value: float
    session: Session


def est_max_series(sessions: Sequence[Session]) -> list[EstMaxPoint]:
    """Session est. max over time. Sessions without a set that counts are left out."""
    points = []
    for session in sorted(sessions, key=lambda s: s.at):
        value = session_est_max(session)
        if value is not None:
            points.append(EstMaxPoint(session.at, value, session))
    return points


def best_set_overall(sessions: Sequence[Session]) -> tuple[LoggedSet, datetime] | None:
    """The set with the highest est. max ever (the earliest on ties)."""
    best: tuple[float, LoggedSet, datetime] | None = None
    for session in sorted(sessions, key=lambda s: s.at):
        s = best_set(session)
        if s is not None and (best is None or set_est_max(session, s) > best[0]):
            best = (set_est_max(session, s), s, session.at)
    return (best[1], best[2]) if best else None


def most_reps(sessions: Sequence[Session]) -> tuple[LoggedSet, datetime] | None:
    """The set with the most reps; ties go to the heavier weight, then the earliest."""
    best: tuple[LoggedSet, datetime] | None = None
    for session in sorted(sessions, key=lambda s: s.at):
        for s in session.sets:
            if _counts(s) and (best is None or (s.reps, s.weight) > (best[0].reps, best[0].weight)):
                best = (s, session.at)
    return best


def heaviest(sessions: Sequence[Session]) -> tuple[float, datetime] | None:
    """The heaviest weight used, and when it was first used."""
    best: tuple[float, datetime] | None = None
    for session in sorted(sessions, key=lambda s: s.at):
        for s in session.sets:
            if _counts(s) and (best is None or s.weight > best[0]):
                best = (s.weight, session.at)
    return best
