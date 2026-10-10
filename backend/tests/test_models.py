import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import delete, inspect, select
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base
from app.models import (
    BodyweightEntry,
    Exercise,
    Set,
    Split,
    SplitDay,
    SplitDayExercise,
    User,
    UserSettings,
    Workout,
    WorkoutExercise,
)

pytestmark = pytest.mark.anyio

LB_TO_KG = Decimal("0.45359237")
NOW = datetime(2026, 10, 9, 18, 0, tzinfo=UTC)


def make_user(email: str = "lifter@example.com") -> User:
    return User(id=uuid.uuid4(), email=email, password_hash="not-a-real-hash")


def make_workout(user: User, **overrides: object) -> Workout:
    values: dict[str, object] = {
        "id": uuid.uuid4(),
        "user_id": user.id,
        "title": "Shoulders & Arms",
        "started_at": NOW,
        "bodyweight_kg": Decimal("78.018"),
    }
    return Workout(**(values | overrides))


@dataclass
class Graph:
    """One user with a split, a day, a library exercise and a workout using it."""

    user: User
    exercise: Exercise
    split: Split
    day: SplitDay
    workout: Workout
    workout_exercise: WorkoutExercise


@pytest.fixture
async def graph(session: AsyncSession) -> Graph:
    user = make_user()
    session.add(user)
    await session.flush()

    exercise = Exercise(
        id=uuid.uuid4(),
        name="Bicep curl",
        primary_muscle="biceps",
        secondary_muscles=["forearms"],
        equipment="dumbbell",
        kind="weighted",
    )
    split = Split(id=uuid.uuid4(), user_id=user.id, name="Arnold split", repeat_mode="in_order")
    session.add_all([exercise, split])
    await session.flush()

    day = SplitDay(
        id=uuid.uuid4(), user_id=user.id, split_id=split.id, name="Shoulders & Arms", position=1
    )
    workout = make_workout(user)
    session.add_all([day, workout])
    await session.flush()

    workout_exercise = WorkoutExercise(
        id=uuid.uuid4(),
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=exercise.id,
        position=0,
        rest_seconds=90,
    )
    session.add(workout_exercise)
    await session.flush()
    return Graph(user, exercise, split, day, workout, workout_exercise)


async def test_migration_creates_every_model_table(session: AsyncSession) -> None:
    conn = await session.connection()
    tables = await conn.run_sync(lambda c: set(inspect(c).get_table_names()))

    assert tables == set(Base.metadata.tables) | {"alembic_version"}


async def test_migration_matches_models(session: AsyncSession) -> None:
    conn = await session.connection()
    diffs = await conn.run_sync(
        lambda c: compare_metadata(MigrationContext.configure(c), Base.metadata)
    )

    assert diffs == []


async def test_full_workout_round_trips(session: AsyncSession, graph: Graph) -> None:
    split_exercise = SplitDayExercise(
        id=uuid.uuid4(),
        user_id=graph.user.id,
        split_day_id=graph.day.id,
        exercise_id=graph.exercise.id,
        position=0,
        rest_seconds=150,
    )
    logged = Set(
        id=uuid.uuid4(),
        user_id=graph.user.id,
        workout_exercise_id=graph.workout_exercise.id,
        set_number=1,
        weight_kg=Decimal("9.072"),
        reps=12,
        logged_at=NOW,
    )
    session.add_all([split_exercise, logged])
    await session.flush()
    session.expunge_all()

    stored = await session.get_one(Set, logged.id)
    assert (stored.set_number, stored.weight_kg, stored.reps) == (1, Decimal("9.072"), 12)
    assert stored.logged_at == NOW
    assert stored.deleted_at is None

    workout_exercise = await session.get_one(WorkoutExercise, graph.workout_exercise.id)
    assert (workout_exercise.status, workout_exercise.source) == ("planned", "split")
    assert workout_exercise.rest_seconds == 90

    exercise = await session.get_one(Exercise, graph.exercise.id)
    assert exercise.owner_user_id is None
    assert exercise.secondary_muscles == ["forearms"]


async def test_weights_keep_three_decimals_and_convert_back_to_lb(
    session: AsyncSession, graph: Graph
) -> None:
    ten_lb = Decimal(10) * LB_TO_KG  # 4.5359237 kg
    logged = Set(
        id=uuid.uuid4(),
        user_id=graph.user.id,
        workout_exercise_id=graph.workout_exercise.id,
        set_number=1,
        weight_kg=ten_lb,
        reps=12,
        logged_at=NOW,
    )
    session.add(logged)
    await session.flush()
    session.expunge_all()

    stored = await session.get_one(Set, logged.id)
    assert stored.weight_kg == Decimal("4.536")
    assert round(stored.weight_kg / LB_TO_KG, 1) == Decimal("10.0")


async def test_workout_keeps_its_bodyweight_snapshot(session: AsyncSession, graph: Graph) -> None:
    session.add(
        BodyweightEntry(
            id=uuid.uuid4(),
            user_id=graph.user.id,
            weight_kg=Decimal("80.000"),
            measured_on=date(2026, 10, 10),
        )
    )
    await session.flush()
    session.expunge_all()

    workout = await session.get_one(Workout, graph.workout.id)
    assert workout.bodyweight_kg == Decimal("78.018")


async def test_settings_defaults(session: AsyncSession) -> None:
    user = make_user()
    session.add(user)
    await session.flush()
    settings = UserSettings(id=uuid.uuid4(), user_id=user.id)
    session.add(settings)
    await session.flush()
    await session.refresh(settings)

    assert settings.unit == "lb"
    assert settings.active_split_id is None
    assert settings.ghost_mode is True
    assert settings.sync_wifi_only is True
    assert settings.rest_alert_sound is True


async def test_one_settings_row_per_user(session: AsyncSession) -> None:
    user = make_user()
    session.add(user)
    await session.flush()
    session.add(UserSettings(id=uuid.uuid4(), user_id=user.id))
    await session.flush()

    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(UserSettings(id=uuid.uuid4(), user_id=user.id))


async def test_email_is_unique_ignoring_case(session: AsyncSession) -> None:
    session.add(make_user("Lifter@Example.com"))
    await session.flush()

    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(make_user("lifter@example.com"))


async def test_one_in_progress_workout_per_user(session: AsyncSession, graph: Graph) -> None:
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(make_workout(graph.user))

    # Finishing the first one frees the slot.
    graph.workout.ended_at = NOW + timedelta(hours=1)
    await session.flush()
    second = make_workout(graph.user, started_at=NOW + timedelta(days=1))
    session.add(second)
    await session.flush()

    # A soft-deleted in-progress workout does not count.
    second.deleted_at = NOW + timedelta(days=1)
    await session.flush()
    session.add(make_workout(graph.user, started_at=NOW + timedelta(days=2)))
    await session.flush()

    # Other users are independent.
    other = make_user("other@example.com")
    session.add(other)
    await session.flush()
    session.add(make_workout(other))
    await session.flush()


def _split_day(g: Graph, **kw: object) -> SplitDay:
    values: dict[str, object] = {
        "user_id": g.user.id,
        "split_id": g.split.id,
        "name": "Legs",
        "position": 2,
    }
    return SplitDay(**(values | kw))


def _workout_exercise(g: Graph, **kw: object) -> WorkoutExercise:
    values: dict[str, object] = {
        "user_id": g.user.id,
        "workout_id": g.workout.id,
        "exercise_id": g.exercise.id,
        "position": 1,
        "rest_seconds": 60,
    }
    return WorkoutExercise(**(values | kw))


def _set(g: Graph, **kw: object) -> Set:
    values: dict[str, object] = {
        "user_id": g.user.id,
        "workout_exercise_id": g.workout_exercise.id,
        "set_number": 1,
        "weight_kg": Decimal("10"),
        "reps": 8,
        "logged_at": NOW,
    }
    return Set(**(values | kw))


# name: (row builder, text the database error must contain)
INVALID_ROWS: dict[str, tuple[Callable[[Graph], Base], str]] = {
    "unit": (
        lambda g: UserSettings(user_id=g.user.id, unit="stone"),
        "ck_user_settings_unit",
    ),
    "exercise kind": (
        lambda g: Exercise(name="Run", primary_muscle="legs", kind="cardio"),
        "ck_exercises_kind",
    ),
    "repeat mode": (
        lambda g: Split(user_id=g.user.id, name="X", repeat_mode="random"),
        "ck_splits_repeat_mode",
    ),
    "weekday 7": (
        lambda g: _split_day(g, weekday=7),
        "ck_split_days_weekday",
    ),
    "weekday -1": (
        lambda g: _split_day(g, weekday=-1),
        "ck_split_days_weekday",
    ),
    "negative position": (
        lambda g: _split_day(g, position=-1),
        "ck_split_days_position",
    ),
    "negative rest": (
        lambda g: SplitDayExercise(
            user_id=g.user.id,
            split_day_id=g.day.id,
            exercise_id=g.exercise.id,
            position=0,
            rest_seconds=-1,
        ),
        "ck_split_day_exercises_rest_seconds",
    ),
    "workout exercise status": (
        lambda g: _workout_exercise(g, status="maybe"),
        "ck_workout_exercises_status",
    ),
    "workout exercise source": (
        lambda g: _workout_exercise(g, source="copied"),
        "ck_workout_exercises_source",
    ),
    "set number 0": (
        lambda g: _set(g, set_number=0),
        "ck_sets_set_number",
    ),
    "negative reps": (
        lambda g: _set(g, reps=-1),
        "ck_sets_reps",
    ),
    "negative weight": (
        lambda g: _set(g, weight_kg=Decimal("-1")),
        "ck_sets_weight_kg",
    ),
    "weight over 9999.999 kg": (
        lambda g: _set(g, weight_kg=Decimal("10000")),
        "numeric field overflow",
    ),
    "zero bodyweight snapshot": (
        lambda g: make_workout(g.user, ended_at=NOW, bodyweight_kg=Decimal("0")),
        "ck_workouts_bodyweight_kg",
    ),
    "ended before started": (
        lambda g: make_workout(g.user, ended_at=NOW - timedelta(minutes=1)),
        "ck_workouts_ended_after_start",
    ),
    "zero bodyweight entry": (
        lambda g: BodyweightEntry(
            user_id=g.user.id, weight_kg=Decimal("0"), measured_on=date(2026, 10, 9)
        ),
        "ck_bodyweight_entries_weight_kg",
    ),
}


@pytest.mark.parametrize(("build", "error"), INVALID_ROWS.values(), ids=INVALID_ROWS.keys())
async def test_database_rejects_invalid_rows(
    session: AsyncSession, graph: Graph, build: Callable[[Graph], Base], error: str
) -> None:
    with pytest.raises(DBAPIError, match=error):
        async with session.begin_nested():
            session.add(build(graph))


async def test_deleting_a_user_removes_their_rows_but_not_the_library(
    session: AsyncSession, graph: Graph
) -> None:
    custom = Exercise(
        owner_user_id=graph.user.id,
        name="Cable Y raise",
        primary_muscle="shoulders",
        kind="weighted",
    )
    session.add(custom)
    await session.flush()
    session.add(_workout_exercise(graph, exercise_id=custom.id))
    session.add(_set(graph))
    session.add(UserSettings(user_id=graph.user.id, active_split_id=graph.split.id))
    await session.flush()

    await session.execute(delete(User).where(User.id == graph.user.id))
    session.expunge_all()

    for model in (UserSettings, Split, SplitDay, Workout, WorkoutExercise, Set):
        assert (await session.scalars(select(model))).all() == []
    library = (await session.scalars(select(Exercise))).all()
    assert [e.id for e in library] == [graph.exercise.id]
