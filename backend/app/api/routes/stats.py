import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import AwareDatetime

from app import stats
from app.api.deps import CurrentUser, SessionDep
from app.api.errors import not_found_as_404
from app.schemas.common import Kg
from app.schemas.stats import (
    DatedSetOut,
    EstMaxPointOut,
    ExerciseStatsOut,
    FrontierOut,
    FrontierPointOut,
    HeaviestOut,
    OneWeightStatsOut,
    PlateauOut,
    ProgressItemOut,
    ProjectionOut,
    SessionOut,
    SetOut,
    WeightSessionOut,
    WeightUseOut,
)
from app.services import stats as stats_service

router = APIRouter(tags=["stats"])

Weeks = Annotated[int, Query(ge=1, le=520, description="Window for sparkline and change")]


def _kg(value: float) -> float:
    return round(value, 3)


def _plateau(p: stats.Plateau | None) -> PlateauOut | None:
    if p is None:
        return None
    return PlateauOut(weeks_flat=p.weeks_flat, best_kg=_kg(p.best), best_at=p.best_at)


def _frontier(points: list[stats.FrontierPoint]) -> list[FrontierPointOut]:
    return [FrontierPointOut(weight_kg=p.weight, reps=p.reps, at=p.at) for p in points]


async def _sessions(
    session: SessionDep, user: CurrentUser, exercise_id: uuid.UUID
) -> tuple[bool, list[stats.Session]]:
    with not_found_as_404("Exercise"):
        exercise = await stats_service.require_exercise(session, exercise_id, user.id)
    found = await stats_service.sessions_by_exercise(session, user.id, exercise_id)
    return exercise.kind == "bodyweight", found[exercise_id][1] if exercise_id in found else []


@router.get("/stats/progress")
async def progress(
    user: CurrentUser,
    session: SessionDep,
    weeks: Weeks = 8,
    as_of: AwareDatetime | None = None,
) -> list[ProgressItemOut]:
    """Every exercise the user has finished a session of, most recently trained first."""
    end = as_of or datetime.now(UTC)
    items = []
    for exercise, sessions in (await stats_service.sessions_by_exercise(session, user.id)).values():
        series = [p for p in stats.est_max_series(sessions) if p.at <= end]
        if not series:
            continue
        window = [p for p in series if p.at >= end - timedelta(weeks=weeks)]
        items.append(
            ProgressItemOut(
                exercise_id=exercise.id,
                includes_bodyweight=exercise.kind == "bodyweight",
                sessions=len(series),
                latest_at=series[-1].at,
                est_max_kg=_kg(series[-1].value),
                change=stats.change_in_window(series, end=end, weeks=weeks),
                is_new_best=stats.is_new_best(series),
                plateau=_plateau(stats.plateau(series)),
                sparkline=[EstMaxPointOut(at=p.at, est_max_kg=_kg(p.value)) for p in window],
            )
        )
    return sorted(items, key=lambda i: i.latest_at, reverse=True)


@router.get("/stats/exercises/{exercise_id}")
async def exercise_stats(
    exercise_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> ExerciseStatsOut:
    """Everything Exercise detail (14) shows."""
    includes_bodyweight, sessions = await _sessions(session, user, exercise_id)
    series = stats.est_max_series(sessions)
    best = stats.best_set_overall(sessions)
    most = stats.most_reps(sessions)
    heaviest = stats.heaviest(sessions)
    projected = stats.projection(series)
    return ExerciseStatsOut(
        exercise_id=exercise_id,
        includes_bodyweight=includes_bodyweight,
        est_max_kg=_kg(series[-1].value) if series else None,
        latest_at=series[-1].at if series else None,
        first=EstMaxPointOut(at=series[0].at, est_max_kg=_kg(series[0].value)) if series else None,
        is_new_best=stats.is_new_best(series),
        series=[
            SessionOut(
                workout_id=p.session.key,  # type: ignore[arg-type]
                at=p.at,
                est_max_kg=_kg(p.value),
                best_set=_set(stats.best_set(p.session)),
                sets=[_set(s) for s in p.session.sets],
            )
            for p in series
        ],
        weights=[
            WeightUseOut(weight_kg=w.weight, sessions=w.sessions, first_at=w.first_at)
            for w in stats.weights_used(sessions)
        ],
        best_set=DatedSetOut(weight_kg=best[0].weight, reps=best[0].reps, at=best[1])
        if best
        else None,
        most_reps=DatedSetOut(weight_kg=most[0].weight, reps=most[0].reps, at=most[1])
        if most
        else None,
        heaviest=HeaviestOut(weight_kg=heaviest[0], first_at=heaviest[1]) if heaviest else None,
        plateau=_plateau(stats.plateau(series)),
        projection=ProjectionOut(
            at=projected.at,
            est_max_kg=_kg(projected.value),
            weekly_gain_kg=_kg(projected.weekly_gain),
            capped=projected.capped,
        )
        if projected
        else None,
        frontier=_frontier(stats.frontier(sessions)),
    )


def _set(s: stats.LoggedSet | None) -> SetOut:
    assert s is not None  # series only holds sessions with a set that counts
    return SetOut(weight_kg=s.weight, reps=s.reps)


@router.get("/stats/exercises/{exercise_id}/weights/{weight_kg}")
async def one_weight_stats(
    exercise_id: uuid.UUID, weight_kg: Kg, user: CurrentUser, session: SessionDep
) -> OneWeightStatsOut:
    """One-weight views (15, 16): only sets done at exactly this weight (rounded to the gram,
    like stored weights)."""
    _, sessions = await _sessions(session, user, exercise_id)
    weight = float(Decimal(weight_kg))
    at_weight = stats.sessions_at_weight(sessions, weight)
    return OneWeightStatsOut(
        exercise_id=exercise_id,
        weight_kg=weight,
        sessions=[
            WeightSessionOut(
                workout_id=s.session.key,  # type: ignore[arg-type]
                at=s.at,
                reps=list(s.reps),
                total=s.total,
                average=round(s.average, 2),
                retention=round(s.retention, 4) if s.retention is not None else None,
            )
            for s in at_weight
        ],
        total_change=at_weight[-1].total - at_weight[0].total if len(at_weight) >= 2 else None,
        first_retention=at_weight[0].retention if at_weight else None,
        latest_retention=at_weight[-1].retention if at_weight else None,
        moved_up_on=stats.moved_up_on(sessions, weight),
    )


@router.get("/stats/exercises/{exercise_id}/frontier")
async def frontier(
    exercise_id: uuid.UUID,
    user: CurrentUser,
    session: SessionDep,
    as_of: AwareDatetime | None = None,
) -> FrontierOut:
    """Rep-weight frontier (17), optionally as it stood at `as_of` ("compare with")."""
    _, sessions = await _sessions(session, user, exercise_id)
    return FrontierOut(
        exercise_id=exercise_id, as_of=as_of, points=_frontier(stats.frontier(sessions, as_of))
    )
