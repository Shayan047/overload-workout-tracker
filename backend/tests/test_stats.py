"""Pure stats functions against the sample data in docs/product-spec.md (weights in lb)."""

from datetime import UTC, datetime, timedelta

import pytest

from app.stats import (
    LoggedSet,
    Session,
    best_set_overall,
    change_in_window,
    epley,
    est_max_series,
    frontier,
    heaviest,
    is_new_best,
    most_reps,
    moved_up_on,
    plateau,
    projection,
    retention,
    session_est_max,
    sessions_at_weight,
    weights_used,
)


def at(month: int, day: int) -> datetime:
    return datetime(2026, month, day, 18, tzinfo=UTC)


def session(when: datetime, weight: float, reps: list[int], bodyweight: float = 0.0) -> Session:
    return Session(at=when, sets=tuple(LoggedSet(weight, r) for r in reps), bodyweight=bodyweight)


# Bicep curl, from the product spec.
SAMPLE = [
    session(at(8, 18), 10, [12, 8, 7, 7]),
    session(at(8, 21), 10, [12, 9, 9, 8]),
    session(at(8, 25), 10, [12, 10, 9, 9]),
    session(at(8, 28), 10, [13, 11, 10, 10]),
    session(at(9, 1), 10, [14, 12, 11, 11]),
    session(at(9, 28), 15, [12, 10, 9, 9]),
    session(at(10, 6), 20, [6, 5, 5, 4]),
    session(at(10, 9), 20, [7, 6, 6, 5]),
]


def test_epley() -> None:
    assert epley(100, 0) == 100
    assert epley(100, 30) == 200
    assert epley(20, 7) == pytest.approx(24.667, abs=1e-3)


def test_session_est_max_comes_from_the_best_set() -> None:
    assert round(session_est_max(SAMPLE[5]), 1) == 21.0  # type: ignore[arg-type]
    assert round(session_est_max(SAMPLE[6]), 1) == 24.0  # type: ignore[arg-type]
    assert round(session_est_max(SAMPLE[7]), 1) == 24.7  # type: ignore[arg-type]


def test_one_weight_totals_and_retention_at_10_lb() -> None:
    at_ten = sessions_at_weight(SAMPLE, 10)

    assert [s.at for s in at_ten] == [at(8, 18), at(8, 21), at(8, 25), at(8, 28), at(9, 1)]
    assert [s.total for s in at_ten] == [34, 38, 40, 44, 48]
    assert [s.average for s in at_ten] == [8.5, 9.5, 10.0, 11.0, 12.0]
    assert [round(s.retention * 100) for s in at_ten] == [58, 67, 75, 77, 79]  # type: ignore[operator]


def test_one_weight_only_uses_sets_at_that_exact_weight() -> None:
    mixed = session(at(9, 2), 10, [12, 10])
    mixed = Session(at=mixed.at, sets=(*mixed.sets, LoggedSet(12.5, 6), LoggedSet(10, 9)))

    (only,) = sessions_at_weight([mixed], 10)
    assert only.reps == (12, 10, 9)
    assert sessions_at_weight([mixed], 12.5)[0].reps == (6,)
    assert sessions_at_weight(SAMPLE, 12.5) == []


def test_retention_needs_two_sets_and_a_first_set_with_reps() -> None:
    assert retention([12, 7]) == pytest.approx(7 / 12)
    assert retention([12]) is None
    assert retention([]) is None
    assert retention([0, 5]) is None


def test_frontier_after_oct_9() -> None:
    points = frontier(SAMPLE)
    assert [(p.weight, p.reps) for p in points] == [(10, 14), (15, 12), (20, 7)]


def test_frontier_as_of_earlier_dates() -> None:
    assert [(p.weight, p.reps) for p in frontier(SAMPLE, as_of=at(9, 15))] == [(10, 14)]
    assert [(p.weight, p.reps) for p in frontier(SAMPLE, as_of=at(8, 18))] == [(10, 12)]
    assert frontier(SAMPLE, as_of=at(8, 1)) == []


def test_frontier_drops_dominated_points() -> None:
    sessions = [
        session(at(9, 1), 10, [14]),
        session(at(9, 2), 15, [14]),  # same reps, heavier: 10 × 14 is dominated
        session(at(9, 3), 12.5, [10]),  # lighter and fewer reps than 15 × 14
        session(at(9, 4), 20, [8]),
        session(at(9, 5), 20, [0]),  # failed set: doesn't count
    ]
    assert [(p.weight, p.reps) for p in frontier(sessions)] == [(15, 14), (20, 8)]


def test_est_max_series_change_and_new_best() -> None:
    series = est_max_series(SAMPLE)

    assert [round(p.value, 1) for p in series] == [14.0, 14.0, 14.0, 14.3, 14.7, 21.0, 24.0, 24.7]
    assert round(series[-1].value - series[0].value, 1) == 10.7  # "Up 10.7 lb since Aug 18"
    assert round(change_in_window(series, end=at(10, 9), weeks=8) * 100) == 76  # type: ignore[operator]
    assert is_new_best(series)
    assert not is_new_best(series[:3])  # Aug 25 only tied the best


def test_records_for_exercise_detail() -> None:
    best, best_at = best_set_overall(SAMPLE)  # type: ignore[misc]
    assert (best.weight, best.reps, best_at) == (20, 7, at(10, 9))

    most, most_at = most_reps(SAMPLE)  # type: ignore[misc]
    assert (most.weight, most.reps, most_at) == (10, 14, at(9, 1))

    assert heaviest(SAMPLE) == (20, at(10, 6))


def test_weights_used_and_moving_up() -> None:
    used = weights_used(SAMPLE)

    assert [(w.weight, w.sessions, w.first_at) for w in used] == [
        (10, 5, at(8, 18)),
        (15, 1, at(9, 28)),
        (20, 2, at(10, 6)),
    ]
    assert moved_up_on(SAMPLE, 10) == at(9, 28)
    assert moved_up_on(SAMPLE, 20) is None


def test_sample_has_no_plateau() -> None:
    assert plateau(est_max_series(SAMPLE)) is None


def test_plateau_when_the_best_is_three_weeks_old() -> None:
    start = at(9, 1)
    bench = [session(start, 200, [5])] + [
        session(start + timedelta(days=4 * i), 195, [5]) for i in range(1, 7)
    ]  # best on Sep 1, then six lighter sessions through Sep 25

    flat = plateau(est_max_series(bench))

    assert flat is not None
    assert flat.best_at == start
    assert flat.weeks_flat == 3

    assert plateau(est_max_series(bench[:5])) is None  # only 16 days since the best


def test_projection_follows_the_trend_with_a_cap() -> None:
    series = est_max_series(SAMPLE)

    projected = projection(series)

    assert projected is not None
    assert projected.at == at(10, 9) + timedelta(weeks=8)
    assert projected.capped  # moving up from 10 to 20 lb is too steep to extrapolate
    assert projected.weekly_gain == pytest.approx(0.015 * series[-1].value)
    assert round(projected.value, 1) == 27.6  # "on pace for about 28 lb"


def test_projection_of_a_gentle_trend_is_not_capped() -> None:
    gentle = [session(at(9, 1) + timedelta(weeks=i), 100 + i, [5]) for i in range(6)]

    projected = projection(est_max_series(gentle))

    assert projected is not None and not projected.capped
    per_week = epley(1, 5)  # +1 lb a week at 5 reps
    assert projected.weekly_gain == pytest.approx(per_week)
    assert projected.value == pytest.approx(epley(105, 5) + 8 * per_week)


def test_projection_never_predicts_a_loss_and_needs_enough_data() -> None:
    falling = [session(at(9, 1) + timedelta(weeks=i), 100 - i, [5]) for i in range(5)]
    flat = projection(est_max_series(falling))
    assert flat is not None and flat.weekly_gain == 0
    assert flat.value == pytest.approx(epley(96, 5))

    assert projection(est_max_series(falling[:2])) is None  # fewer than 3 sessions
    close = [session(at(9, 1) + timedelta(days=i), 100, [5]) for i in range(4)]
    assert projection(est_max_series(close)) is None  # spans less than 2 weeks


def test_bodyweight_exercises_count_the_whole_load() -> None:
    chin_ups = [
        session(at(10, 1), 0, [12, 10], bodyweight=170),
        session(at(10, 6), 10, [8, 6, 6], bodyweight=172),
    ]

    assert session_est_max(chin_ups[1]) == pytest.approx(epley(182, 8))
    # One-weight views and the frontier use the weight that was added.
    assert [(p.weight, p.reps) for p in frontier(chin_ups)] == [(0, 12), (10, 8)]
    assert sessions_at_weight(chin_ups, 10)[0].reps == (8, 6, 6)
    # 170 × (1 + 12/30) = 238 beats 182 × (1 + 8/30) ≈ 230.5.
    best, _ = best_set_overall(chin_ups)  # type: ignore[misc]
    assert (best.weight, best.reps) == (0, 12)


def test_empty_history() -> None:
    assert est_max_series([]) == []
    assert frontier([]) == []
    assert plateau([]) is None
    assert projection([]) is None
    assert change_in_window([], end=at(10, 9), weeks=8) is None
    assert not is_new_best([])
    assert best_set_overall([]) is None
    assert most_reps([]) is None
    assert heaviest([]) is None
