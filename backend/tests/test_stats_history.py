"""History recaps (screen 18): sets per workout and "Ahead on N of M", by the summary's rule
(screen 11, design 24): at the same top weight more total reps is ahead; a heavier top
weight is ahead; at a lighter one a higher est. max is ahead."""

from datetime import UTC, datetime

from app.stats import LoggedSet, Session, WorkoutRecap, is_ahead, workout_recaps


def at(month: int, day: int) -> datetime:
    return datetime(2026, month, day, 18, tzinfo=UTC)


def session(
    workout: str, when: datetime, reps: list[int], weight: float = 10, bodyweight: float = 0.0
) -> Session:
    return Session(
        at=when, sets=tuple(LoggedSet(weight, r) for r in reps), bodyweight=bodyweight, key=workout
    )


def test_ahead_against_each_exercises_previous_session() -> None:
    curl = [  # docs/product-spec.md: totals 34, 38, 40, 44, 48
        session("a", at(8, 18), [12, 8, 7, 7]),
        session("b", at(8, 21), [12, 9, 9, 8]),
        session("c", at(8, 25), [12, 10, 9, 9]),
        session("d", at(8, 28), [13, 11, 10, 10]),
        session("e", at(9, 1), [14, 12, 11, 11]),
    ]
    press = [  # 24, 24 (level is not ahead), then up to 65 with 20 reps (heavier is ahead)
        session("a", at(8, 18), [8, 8, 8], 60),
        session("c", at(8, 25), [8, 8, 8], 60),
        session("e", at(9, 1), [7, 7, 6], 65),
    ]
    recaps = workout_recaps([curl, press])
    assert recaps["a"] == WorkoutRecap(sets=7, ahead=0, compared=0)
    assert recaps["b"] == WorkoutRecap(sets=4, ahead=1, compared=1)
    assert recaps["c"] == WorkoutRecap(sets=7, ahead=1, compared=2)
    assert recaps["e"] == WorkoutRecap(sets=7, ahead=2, compared=2)


def test_sessions_are_taken_in_date_order() -> None:
    recaps = workout_recaps(
        [[session("late", at(9, 1), [10, 10]), session("early", at(8, 1), [8, 8])]]
    )
    assert recaps["late"] == WorkoutRecap(sets=2, ahead=1, compared=1)
    assert recaps["early"] == WorkoutRecap(sets=2, ahead=0, compared=0)


def test_same_weight_compares_total_reps() -> None:
    last = session("a", at(10, 6), [6, 5, 5, 4], 20)
    assert is_ahead(session("b", at(10, 9), [7, 6, 6, 5], 20), last)
    assert not is_ahead(session("b", at(10, 9), [6, 5, 5, 4], 20), last)


def test_heavier_is_ahead_even_with_fewer_reps() -> None:
    # The user's example: 20 × 13 last time, then 22.5 × 8.
    assert is_ahead(session("b", at(10, 9), [8], 22.5), session("a", at(10, 6), [13], 20))


def test_lighter_compares_est_max() -> None:
    last = session("a", at(10, 6), [6], 20)  # 24.0
    assert not is_ahead(session("b", at(10, 9), [10], 17.5), last)  # 23.3
    assert is_ahead(session("b", at(10, 9), [12], 17.5), last)  # 24.5


def test_bodyweight_exercises_compare_added_weight_and_count_each_bodyweight() -> None:
    last = session("a", at(10, 6), [8], 10, bodyweight=78)
    assert is_ahead(session("b", at(10, 9), [6], 15, bodyweight=78), last)  # heavier added weight
    # Less added weight, heavier body, same reps: 82 + 5 = 87 against 78 + 10 = 88, so not ahead.
    assert not is_ahead(session("b", at(10, 9), [8], 5, bodyweight=82), last)
    assert is_ahead(session("b", at(10, 9), [8], 5, bodyweight=84), last)


def test_zero_rep_sets_never_decide_the_weight() -> None:
    last = session("a", at(10, 6), [9, 9], 100)
    current = Session(at=at(10, 9), sets=(LoggedSet(110, 0), LoggedSet(100, 10), LoggedSet(100, 9)))
    assert is_ahead(current, last)  # same top weight (100), 19 reps against 18
