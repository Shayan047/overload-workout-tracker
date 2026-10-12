"""Plateau, projection and change over time, from the session est. max series."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.stats.est_max import EstMaxPoint

PLATEAU_MIN_DAYS = 21
PLATEAU_MIN_SESSIONS_AFTER = 2

PROJECTION_WINDOW_WEEKS = 8
PROJECTION_HORIZON_WEEKS = 8
PROJECTION_MIN_SESSIONS = 3
PROJECTION_MIN_SPAN_DAYS = 14
# Gains slow down; a straight line through a jump to a heavier weight would promise far too
# much. Cap the projected gain at this fraction of the current est. max per week.
PROJECTION_MAX_WEEKLY_GAIN = 0.015


def is_new_best(series: Sequence[EstMaxPoint]) -> bool:
    """The latest session beat every earlier one (a tie is not a new best)."""
    if len(series) < 2:
        return False
    return series[-1].value > max(p.value for p in series[:-1])


def change_in_window(series: Sequence[EstMaxPoint], end: datetime, weeks: int) -> float | None:
    """Latest est. max vs the first session in the `weeks` before `end`, as a fraction
    (0.76 = +76%). None without two sessions in the window."""
    start = end - timedelta(weeks=weeks)
    window = [p for p in series if start <= p.at <= end]
    if len(window) < 2 or window[0].value <= 0:
        return None
    return window[-1].value / window[0].value - 1


@dataclass(frozen=True)
class Plateau:
    weeks_flat: int
    best: float
    best_at: datetime


def plateau(series: Sequence[EstMaxPoint]) -> Plateau | None:
    """Flat when the best est. max ever was set at least 3 weeks before the latest session,
    with at least 2 sessions since. Measured to the latest session, not to today, so a lift
    that was simply not trained lately is not called a plateau."""
    if not series:
        return None
    best = series[0]
    for point in series[1:]:
        if point.value > best.value:
            best = point
    after = [p for p in series if p.at > best.at]
    days = (series[-1].at - best.at).days
    if days < PLATEAU_MIN_DAYS or len(after) < PLATEAU_MIN_SESSIONS_AFTER:
        return None
    return Plateau(weeks_flat=days // 7, best=best.value, best_at=best.at)


@dataclass(frozen=True)
class Projection:
    at: datetime
    value: float
    weekly_gain: float
    capped: bool


def _slope_per_day(points: Sequence[EstMaxPoint]) -> float:
    xs = [(p.at - points[0].at).total_seconds() / 86400 for p in points]
    ys = [p.value for p in points]
    mean_x, mean_y = sum(xs) / len(xs), sum(ys) / len(ys)
    spread = sum((x - mean_x) ** 2 for x in xs)
    return sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys, strict=True)) / spread


def projection(series: Sequence[EstMaxPoint]) -> Projection | None:
    """Est. max "if the trend holds": a least-squares line through the sessions of the last 8 weeks,
    projected 8 weeks past the latest session from its est. max. The weekly gain is never
    negative and at most 1.5% of the latest est. max. Needs 3 sessions spanning 2 weeks."""
    if not series:
        return None
    latest = series[-1]
    window = [p for p in series if p.at >= latest.at - timedelta(weeks=PROJECTION_WINDOW_WEEKS)]
    span = (window[-1].at - window[0].at).days
    if len(window) < PROJECTION_MIN_SESSIONS or span < PROJECTION_MIN_SPAN_DAYS:
        return None
    trend = max(_slope_per_day(window) * 7, 0.0)
    cap = PROJECTION_MAX_WEEKLY_GAIN * latest.value
    weekly_gain = min(trend, cap)
    return Projection(
        at=latest.at + timedelta(weeks=PROJECTION_HORIZON_WEEKS),
        value=latest.value + weekly_gain * PROJECTION_HORIZON_WEEKS,
        weekly_gain=weekly_gain,
        capped=trend > cap,
    )
