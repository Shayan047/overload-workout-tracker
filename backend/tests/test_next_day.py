"""Pure next-day rule (no database)."""

import uuid
from datetime import UTC, date, datetime, timedelta

from app.services.splits import DayRef, next_day

T0 = datetime(2026, 9, 1, tzinfo=UTC)
FRIDAY = date(2026, 10, 9)  # weekday() == 4


def days(n: int, weekdays: list[int | None] | None = None) -> list[DayRef]:
    weekdays = weekdays or [None] * n
    return [
        DayRef(id=uuid.uuid4(), position=i, created_at=T0, weekday=weekdays[i], deleted=False)
        for i in range(n)
    ]


def test_in_order_starts_at_the_first_day() -> None:
    split = days(3)
    assert next_day(split, "in_order", last_done=None, on=FRIDAY) == split[0].id


def test_in_order_moves_to_the_day_after_the_last_one_done() -> None:
    split = days(3)
    assert next_day(split, "in_order", last_done=split[0].id, on=FRIDAY) == split[1].id
    assert next_day(split, "in_order", last_done=split[1].id, on=FRIDAY) == split[2].id


def test_in_order_wraps_after_the_last_day() -> None:
    split = days(3)
    assert next_day(split, "in_order", last_done=split[2].id, on=FRIDAY) == split[0].id


def test_in_order_ignores_the_calendar() -> None:
    split = days(3)
    results = {
        next_day(split, "in_order", last_done=split[0].id, on=FRIDAY + timedelta(days=n))
        for n in range(14)
    }
    assert results == {split[1].id}


def test_in_order_continues_after_a_deleted_last_day() -> None:
    split = days(4)
    deleted = DayRef(**{**split[1].__dict__, "deleted": True})
    split[1] = deleted
    assert next_day(split, "in_order", last_done=deleted.id, on=FRIDAY) == split[2].id


def test_in_order_skips_deleted_days() -> None:
    split = days(3)
    split[1] = DayRef(**{**split[1].__dict__, "deleted": True})
    assert next_day(split, "in_order", last_done=split[0].id, on=FRIDAY) == split[2].id


def test_in_order_breaks_position_ties_by_creation_time() -> None:
    first = DayRef(id=uuid.uuid4(), position=0, created_at=T0, weekday=None, deleted=False)
    second = DayRef(
        id=uuid.uuid4(),
        position=0,
        created_at=T0 + timedelta(seconds=1),
        weekday=None,
        deleted=False,
    )
    assert next_day([second, first], "in_order", last_done=first.id, on=FRIDAY) == second.id


def test_in_order_unknown_last_day_starts_over() -> None:
    split = days(2)
    assert next_day(split, "in_order", last_done=uuid.uuid4(), on=FRIDAY) == split[0].id


def test_no_live_days_means_no_next_day() -> None:
    assert next_day([], "in_order", last_done=None, on=FRIDAY) is None
    gone = [DayRef(**{**d.__dict__, "deleted": True}) for d in days(2, [4, 4])]
    assert next_day(gone, "weekdays", last_done=None, on=FRIDAY) is None


def test_weekdays_picks_the_day_for_that_weekday() -> None:
    split = days(3, [0, 2, 4])  # Mon, Wed, Fri
    assert next_day(split, "weekdays", last_done=None, on=FRIDAY) == split[2].id
    assert next_day(split, "weekdays", last_done=None, on=FRIDAY - timedelta(days=4)) == split[0].id


def test_weekdays_other_days_are_rest_days() -> None:
    split = days(3, [0, 2, 4])
    for rest in (1, 3, 5, 6):  # Tue, Thu, Sat, Sun
        on = FRIDAY - timedelta(days=4) + timedelta(days=rest)
        assert next_day(split, "weekdays", last_done=None, on=on) is None


def test_weekdays_ignores_what_was_done_last() -> None:
    split = days(3, [0, 2, 4])
    assert next_day(split, "weekdays", last_done=split[2].id, on=FRIDAY) == split[2].id
