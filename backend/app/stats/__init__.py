"""Pure stats functions: no database, no I/O, any weight unit. See docs/product-spec.md."""

from app.stats.est_max import (
    EstMaxPoint,
    best_set,
    best_set_overall,
    epley,
    est_max_series,
    heaviest,
    most_reps,
    session_est_max,
    set_est_max,
)
from app.stats.frontier import FrontierPoint, frontier
from app.stats.one_weight import (
    WeightSession,
    WeightUse,
    moved_up_on,
    retention,
    sessions_at_weight,
    weights_used,
)
from app.stats.trend import Plateau, Projection, change_in_window, is_new_best, plateau, projection
from app.stats.types import LoggedSet, Session

__all__ = [
    "EstMaxPoint",
    "FrontierPoint",
    "LoggedSet",
    "Plateau",
    "Projection",
    "Session",
    "WeightSession",
    "WeightUse",
    "best_set",
    "best_set_overall",
    "change_in_window",
    "epley",
    "est_max_series",
    "frontier",
    "heaviest",
    "is_new_best",
    "most_reps",
    "moved_up_on",
    "plateau",
    "projection",
    "retention",
    "session_est_max",
    "sessions_at_weight",
    "set_est_max",
    "weights_used",
]
