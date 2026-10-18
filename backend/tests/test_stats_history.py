"""History recaps (screen 18): sets per workout and "Ahead on N of M", where an exercise is
ahead when its total reps beat its previous session (the summary's rule, screen 11)."""

from datetime import UTC, datetime

from app.stats import LoggedSet, Session, WorkoutRecap, workout_recaps


def at(month: int, day: int) -> datetime:
    return datetime(2026, month, day, 18, tzinfo=UTC)


def session(workout: str, when: datetime, reps: list[int], weight: float = 10) -> Session:
    return Session(at=when, sets=tuple(LoggedSet(weight, r) for r in reps), key=workout)


def test_ahead_against_each_exercises_previous_session() -> None:
    curl = [  # docs/product-spec.md: totals 34, 38, 40, 44, 48
        session("a", at(8, 18), [12, 8, 7, 7]),
        session("b", at(8, 21), [12, 9, 9, 8]),
        session("c", at(8, 25), [12, 10, 9, 9]),
        session("d", at(8, 28), [13, 11, 10, 10]),
        session("e", at(9, 1), [14, 12, 11, 11]),
    ]
    press = [  # 24, 24 (level is not ahead), 20 (behind)
        session("a", at(8, 18), [8, 8, 8], 60),
        session("c", at(8, 25), [8, 8, 8], 60),
        session("e", at(9, 1), [7, 7, 6], 65),
    ]
    recaps = workout_recaps([curl, press])
    assert recaps["a"] == WorkoutRecap(sets=7, ahead=0, compared=0)
    assert recaps["b"] == WorkoutRecap(sets=4, ahead=1, compared=1)
    assert recaps["c"] == WorkoutRecap(sets=7, ahead=1, compared=2)
    assert recaps["e"] == WorkoutRecap(sets=7, ahead=1, compared=2)


def test_sessions_are_taken_in_date_order() -> None:
    recaps = workout_recaps(
        [[session("late", at(9, 1), [10, 10]), session("early", at(8, 1), [8, 8])]]
    )
    assert recaps["late"] == WorkoutRecap(sets=2, ahead=1, compared=1)
    assert recaps["early"] == WorkoutRecap(sets=2, ahead=0, compared=0)
