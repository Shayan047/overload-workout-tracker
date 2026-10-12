"""Rep-weight frontier (rule 8)."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from app.stats.types import Session


@dataclass(frozen=True)
class FrontierPoint:
    weight: float  # as entered; for bodyweight exercises, the added weight
    reps: int
    at: datetime  # when these reps were first reached at this weight


def frontier(sessions: Sequence[Session], as_of: datetime | None = None) -> list[FrontierPoint]:
    """For each weight keep the most reps ever done, then drop every point that another
    point matches or beats on both weight and reps. Lightest first. With `as_of`, only
    sessions up to then count (for "compare with" an earlier date)."""
    best: dict[float, FrontierPoint] = {}
    for session in sorted(sessions, key=lambda s: s.at):
        if as_of is not None and session.at > as_of:
            break
        for s in session.sets:
            if s.reps >= 1 and (s.weight not in best or s.reps > best[s.weight].reps):
                best[s.weight] = FrontierPoint(s.weight, s.reps, session.at)

    points = sorted(best.values(), key=lambda p: p.weight)
    return [
        p
        for p in points
        if not any(q is not p and q.weight >= p.weight and q.reps >= p.reps for q in points)
    ]
