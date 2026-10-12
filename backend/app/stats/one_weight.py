"""One-weight views (rule 7): only sets done at that exact weight count."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from app.stats.types import Session


def retention(reps: Sequence[int]) -> float | None:
    """Reps in the last set ÷ reps in the first set. Needs two sets and a first set with reps."""
    if len(reps) < 2 or reps[0] <= 0:
        return None
    return reps[-1] / reps[0]


@dataclass(frozen=True)
class WeightSession:
    at: datetime
    reps: tuple[int, ...]  # in the order the sets were done
    session: Session

    @property
    def total(self) -> int:
        return sum(self.reps)

    @property
    def average(self) -> float:
        return self.total / len(self.reps)

    @property
    def retention(self) -> float | None:
        return retention(self.reps)


def sessions_at_weight(sessions: Sequence[Session], weight: float) -> list[WeightSession]:
    """Sessions with at least one set at exactly `weight`, oldest first."""
    found = []
    for session in sorted(sessions, key=lambda s: s.at):
        reps = tuple(s.reps for s in session.sets if s.weight == weight)
        if reps:
            found.append(WeightSession(session.at, reps, session))
    return found


@dataclass(frozen=True)
class WeightUse:
    weight: float
    sessions: int
    first_at: datetime


def weights_used(sessions: Sequence[Session]) -> list[WeightUse]:
    """Every weight used (the weight chips), lightest first."""
    uses: dict[float, list[datetime]] = {}
    for session in sorted(sessions, key=lambda s: s.at):
        for weight in {s.weight for s in session.sets}:
            uses.setdefault(weight, []).append(session.at)
    return [WeightUse(w, len(ats), ats[0]) for w, ats in sorted(uses.items())]


def moved_up_on(sessions: Sequence[Session], weight: float) -> datetime | None:
    """When a heavier weight was first used, after `weight` was first used."""
    ordered = sorted(sessions, key=lambda s: s.at)
    first = next((s.at for s in ordered if any(x.weight == weight for x in s.sets)), None)
    if first is None:
        return None
    return next(
        (s.at for s in ordered if s.at > first and any(x.weight > weight for x in s.sets)), None
    )
