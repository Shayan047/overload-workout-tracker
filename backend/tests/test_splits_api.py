import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Split, SplitDay, SplitDayExercise, Workout
from app.seed.exercises import library_exercise_id, load_library, seed_exercises
from app.services.presets import PRESETS
from tests.conftest import SignedIn, just_before

pytestmark = pytest.mark.anyio

CURL = library_exercise_id("Dumbbell_Bicep_Curl")
CHIN_UP = library_exercise_id("Chin-Up")


@pytest.fixture
async def library(session: AsyncSession) -> None:
    await seed_exercises(session)


async def from_preset(client: AsyncClient, who: SignedIn, key: str) -> dict[str, Any]:
    response = await client.post(
        f"/splits/{uuid.uuid4()}/from-preset", headers=who.headers, json={"preset": key}
    )
    assert response.status_code == 200, response.text
    return response.json()


async def put(client: AsyncClient, who: SignedIn, path: str, body: dict[str, Any]) -> Any:
    return await client.put(path, headers=who.headers, json=body)


async def detail(client: AsyncClient, who: SignedIn, split_id: str) -> dict[str, Any]:
    response = await client.get(f"/splits/{split_id}", headers=who.headers)
    assert response.status_code == 200, response.text
    return response.json()


async def test_presets_are_listed_with_library_exercises(client: AsyncClient) -> None:
    # Public: onboarding shows them before the account exists.
    response = await client.get("/presets")

    assert response.status_code == 200
    presets = {p["key"]: p for p in response.json()}
    assert list(presets) == ["push_pull_legs", "arnold", "upper_lower", "body_part", "full_body"]
    assert [d["name"] for d in presets["arnold"]["days"]] == [
        "Chest & Back",
        "Shoulders & Arms",
        "Legs",
    ]
    library_ids = {str(row["id"]) for row in load_library()}
    for preset in presets.values():
        for day in preset["days"]:
            assert day["exercises"]
            for exercise in day["exercises"]:
                assert exercise["exercise_id"] in library_ids
                assert 0 < exercise["rest_seconds"] <= 300


@pytest.mark.parametrize("key", list(PRESETS))
async def test_create_a_split_from_each_preset(
    client: AsyncClient, session: AsyncSession, signed_in: SignedIn, library: None, key: str
) -> None:
    preset = PRESETS[key]
    split_id = uuid.uuid4()
    url = f"/splits/{split_id}/from-preset"

    response = await client.post(url, headers=signed_in.headers, json={"preset": key})

    assert response.status_code == 200, response.text
    split = response.json()
    assert split["id"] == str(split_id)
    assert (split["name"], split["repeat_mode"]) == (preset.name, preset.repeat_mode)
    assert [(d["name"], d["position"], d["weekday"]) for d in split["days"]] == [
        (d.name, i, d.weekday) for i, d in enumerate(preset.days)
    ]
    for day, preset_day in zip(split["days"], preset.days, strict=True):
        assert [(e["exercise_id"], e["rest_seconds"]) for e in day["exercises"]] == [
            (str(library_exercise_id(e.source_id)), e.rest_seconds) for e in preset_day.exercises
        ]

    # Replaying the request is harmless and creates nothing new.
    replay = await client.post(url, headers=signed_in.headers, json={"preset": key})
    assert replay.json() == split
    day_count = await session.scalar(
        select(func.count()).select_from(SplitDay).where(SplitDay.split_id == split_id)
    )
    assert day_count == len(preset.days)


async def test_arnold_shoulders_and_arms_matches_the_design(
    client: AsyncClient, signed_in: SignedIn, library: None
) -> None:
    split = await from_preset(client, signed_in, "arnold")
    exercises = (await client.get("/exercises", headers=signed_in.headers)).json()
    names = {e["id"]: e["name"] for e in exercises}

    day = split["days"][1]
    assert [(names[e["exercise_id"]], e["rest_seconds"]) for e in day["exercises"]] == [
        ("Standing military press", 150),
        ("Side lateral raise", 60),
        ("Dumbbell bicep curl", 90),
        ("Hammer curls", 90),
        ("Triceps pushdown", 60),
        ("Chin-up", 120),
    ]


async def test_preset_ids_are_derived_from_the_split_id(
    client: AsyncClient, signed_in: SignedIn, library: None
) -> None:
    split = await from_preset(client, signed_in, "push_pull_legs")
    split_id = uuid.UUID(split["id"])

    assert split["days"][0]["id"] == str(uuid.uuid5(split_id, "day:0"))
    assert split["days"][2]["exercises"][1]["id"] == str(uuid.uuid5(split_id, "day:2:exercise:1"))


async def test_from_preset_rejects_unknown_presets_and_other_users_ids(
    client: AsyncClient, signed_in: SignedIn, other_user: SignedIn, library: None
) -> None:
    unknown = await client.post(
        f"/splits/{uuid.uuid4()}/from-preset", headers=signed_in.headers, json={"preset": "bro"}
    )
    assert unknown.status_code == 422

    mine = await from_preset(client, signed_in, "arnold")
    theirs = await client.post(
        f"/splits/{mine['id']}/from-preset", headers=other_user.headers, json={"preset": "arnold"}
    )
    assert theirs.status_code == 404


async def test_build_and_edit_a_custom_split(
    client: AsyncClient, signed_in: SignedIn, library: None
) -> None:
    split_id, day1, day2 = (str(uuid.uuid4()) for _ in range(3))
    curl_row, chin_row = str(uuid.uuid4()), str(uuid.uuid4())

    split = await put(
        client, signed_in, f"/splits/{split_id}", {"name": "Mine", "repeat_mode": "in_order"}
    )
    assert split.status_code == 200
    for day_id, name, position in ((day1, "Arms", 0), (day2, "Legs", 1)):
        response = await put(
            client,
            signed_in,
            f"/split-days/{day_id}",
            {"split_id": split_id, "name": name, "position": position},
        )
        assert response.status_code == 200
    for row_id, exercise, position, rest in ((curl_row, CURL, 0, 90), (chin_row, CHIN_UP, 1, 120)):
        response = await put(
            client,
            signed_in,
            f"/split-day-exercises/{row_id}",
            {
                "split_day_id": day1,
                "exercise_id": str(exercise),
                "position": position,
                "rest_seconds": rest,
            },
        )
        assert response.status_code == 200

    # Rename the split, swap the days' order, move chin-ups first with a longer rest.
    await put(
        client, signed_in, f"/splits/{split_id}", {"name": "Arms first", "repeat_mode": "in_order"}
    )
    await put(
        client,
        signed_in,
        f"/split-days/{day1}",
        {"split_id": split_id, "name": "Arms", "position": 1},
    )
    await put(
        client,
        signed_in,
        f"/split-days/{day2}",
        {"split_id": split_id, "name": "Legs", "position": 0},
    )
    await put(
        client,
        signed_in,
        f"/split-day-exercises/{chin_row}",
        {"split_day_id": day1, "exercise_id": str(CHIN_UP), "position": 0, "rest_seconds": 150},
    )
    await put(
        client,
        signed_in,
        f"/split-day-exercises/{curl_row}",
        {"split_day_id": day1, "exercise_id": str(CURL), "position": 1, "rest_seconds": 90},
    )

    got = await detail(client, signed_in, split_id)
    assert got["name"] == "Arms first"
    assert [d["name"] for d in got["days"]] == ["Legs", "Arms"]
    arms = got["days"][1]
    assert [(e["exercise_id"], e["rest_seconds"]) for e in arms["exercises"]] == [
        (str(CHIN_UP), 150),
        (str(CURL), 90),
    ]

    # Remove an exercise, then a whole day.
    assert (
        await client.delete(f"/split-day-exercises/{curl_row}", headers=signed_in.headers)
    ).status_code == 204
    assert [
        e["id"] for e in (await detail(client, signed_in, split_id))["days"][1]["exercises"]
    ] == [chin_row]
    assert (
        await client.delete(f"/split-days/{day1}", headers=signed_in.headers)
    ).status_code == 204
    assert [d["id"] for d in (await detail(client, signed_in, split_id))["days"]] == [day2]

    # The day's remaining exercise went with it, and pulls report both tombstones.
    pulled = (
        await client.get(
            "/split-day-exercises",
            headers=signed_in.headers,
            params={"updated_since": just_before(split.json()["created_at"])},
        )
    ).json()
    assert {e["id"]: e["deleted_at"] is not None for e in pulled} == {
        curl_row: True,
        chin_row: True,
    }


async def test_deleting_a_split_removes_its_days_and_clears_the_active_split(
    client: AsyncClient, signed_in: SignedIn, library: None
) -> None:
    split = await from_preset(client, signed_in, "arnold")
    settings = (await client.get("/settings", headers=signed_in.headers)).json()
    await put(client, signed_in, "/settings", settings | {"active_split_id": split["id"]})

    assert (
        await client.delete(f"/splits/{split['id']}", headers=signed_in.headers)
    ).status_code == 204

    assert (
        await client.get(f"/splits/{split['id']}", headers=signed_in.headers)
    ).status_code == 404
    assert (await client.get("/splits", headers=signed_in.headers)).json() == []
    assert (await client.get("/split-days", headers=signed_in.headers)).json() == []
    assert (await client.get("/split-day-exercises", headers=signed_in.headers)).json() == []
    assert (await client.get("/settings", headers=signed_in.headers)).json()[
        "active_split_id"
    ] is None


async def test_split_rows_are_validated(
    client: AsyncClient, signed_in: SignedIn, other_user: SignedIn, library: None
) -> None:
    mine = await from_preset(client, signed_in, "arnold")
    theirs = await from_preset(client, other_user, "arnold")
    my_day = mine["days"][0]["id"]
    their_custom = str(uuid.uuid4())
    await put(
        client,
        other_user,
        f"/exercises/{their_custom}",
        {"name": "Secret", "primary_muscle": "chest", "kind": "weighted"},
    )

    def exercise_row(**change: Any) -> dict[str, Any]:
        return {
            "split_day_id": my_day,
            "exercise_id": str(CURL),
            "position": 0,
            "rest_seconds": 90,
        } | change

    cases = [
        (
            f"/split-days/{uuid.uuid4()}",
            {"split_id": theirs["id"], "name": "X", "position": 0},
            404,
        ),
        (
            f"/split-days/{uuid.uuid4()}",
            {"split_id": mine["id"], "name": "X", "position": 0, "weekday": 7},
            422,
        ),
        (f"/split-days/{uuid.uuid4()}", {"split_id": mine["id"], "name": " ", "position": 0}, 422),
        (
            f"/split-day-exercises/{uuid.uuid4()}",
            exercise_row(split_day_id=theirs["days"][0]["id"]),
            404,
        ),
        (f"/split-day-exercises/{uuid.uuid4()}", exercise_row(exercise_id=their_custom), 404),
        (f"/split-day-exercises/{uuid.uuid4()}", exercise_row(exercise_id=str(uuid.uuid4())), 404),
        (f"/split-day-exercises/{uuid.uuid4()}", exercise_row(rest_seconds=-1), 422),
        (f"/split-day-exercises/{uuid.uuid4()}", exercise_row(position=-1), 422),
        (f"/splits/{theirs['id']}", {"name": "Mine now", "repeat_mode": "in_order"}, 404),
        (f"/splits/{uuid.uuid4()}", {"name": "X", "repeat_mode": "random"}, 422),
    ]
    for path, body, expected in cases:
        response = await put(client, signed_in, path, body)
        assert response.status_code == expected, (path, body, response.text)

    assert (
        await client.get(f"/splits/{theirs['id']}", headers=signed_in.headers)
    ).status_code == 404


async def test_settings_round_trip_and_validate_the_active_split(
    client: AsyncClient, signed_in: SignedIn, other_user: SignedIn, library: None
) -> None:
    settings = (await client.get("/settings", headers=signed_in.headers)).json()
    assert settings == settings | {
        "unit": "lb",
        "active_split_id": None,
        "ghost_mode": True,
        "sync_wifi_only": True,
        "rest_alert_sound": True,
    }

    split = await from_preset(client, signed_in, "upper_lower")
    changed = settings | {"unit": "kg", "active_split_id": split["id"], "rest_alert_sound": False}
    response = await put(client, signed_in, "/settings", changed)
    assert response.status_code == 200
    assert response.json()["unit"] == "kg"
    assert response.json()["active_split_id"] == split["id"]

    theirs = await from_preset(client, other_user, "arnold")
    response = await put(
        client, signed_in, "/settings", changed | {"active_split_id": theirs["id"]}
    )
    assert response.status_code == 404
    assert (
        await put(client, signed_in, "/settings", changed | {"unit": "stone"})
    ).status_code == 422


async def finished_workout(
    session: AsyncSession, who: SignedIn, day_id: str, ended: datetime, **extra: Any
) -> Workout:
    workout = Workout(
        user_id=who.user_id,
        split_day_id=uuid.UUID(day_id),
        title="x",
        started_at=ended - timedelta(hours=1),
        ended_at=ended,
        bodyweight_kg=Decimal("78"),
        **extra,
    )
    session.add(workout)
    await session.flush()
    return workout


async def next_day_name(client: AsyncClient, who: SignedIn, split_id: str, on: str) -> str | None:
    response = await client.get(
        f"/splits/{split_id}/next-day", headers=who.headers, params={"on": on}
    )
    assert response.status_code == 200, response.text
    day = response.json()["day"]
    return day["name"] if day else None


async def test_next_day_in_order_ignores_rest_days(
    client: AsyncClient, session: AsyncSession, signed_in: SignedIn, library: None
) -> None:
    split = await from_preset(client, signed_in, "arnold")
    chest, shoulders, legs = (d["id"] for d in split["days"])
    other = await from_preset(client, signed_in, "push_pull_legs")

    assert await next_day_name(client, signed_in, split["id"], "2026-10-01") == "Chest & Back"

    await finished_workout(session, signed_in, chest, datetime(2026, 10, 1, 18, tzinfo=UTC))
    # A week of rest days doesn't move the rotation.
    for day in range(2, 10):
        assert (
            await next_day_name(client, signed_in, split["id"], f"2026-10-0{day}")
            == "Shoulders & Arms"
        )

    # Workouts that are deleted, still in progress or from another split don't count.
    await finished_workout(
        session,
        signed_in,
        shoulders,
        datetime(2026, 10, 3, 18, tzinfo=UTC),
        deleted_at=datetime.now(UTC),
    )
    await finished_workout(
        session, signed_in, other["days"][0]["id"], datetime(2026, 10, 4, 18, tzinfo=UTC)
    )
    session.add(
        Workout(
            user_id=signed_in.user_id,
            split_day_id=uuid.UUID(legs),
            title="x",
            started_at=datetime(2026, 10, 5, 18, tzinfo=UTC),
            bodyweight_kg=Decimal("78"),
        )
    )
    await session.flush()
    assert await next_day_name(client, signed_in, split["id"], "2026-10-09") == "Shoulders & Arms"

    await finished_workout(session, signed_in, shoulders, datetime(2026, 10, 9, 18, tzinfo=UTC))
    assert await next_day_name(client, signed_in, split["id"], "2026-10-09") == "Legs"

    # After the last day it wraps around.
    workouts = await session.scalars(select(Workout).where(Workout.ended_at.is_(None)))
    for workout in workouts:
        workout.ended_at = datetime(2026, 10, 11, 18, tzinfo=UTC)
    await session.flush()
    assert await next_day_name(client, signed_in, split["id"], "2026-10-12") == "Chest & Back"


async def test_next_day_on_set_weekdays(
    client: AsyncClient, session: AsyncSession, signed_in: SignedIn, library: None
) -> None:
    split = await from_preset(client, signed_in, "full_body")
    # Doing Friday's workout doesn't change which day Monday is.
    await finished_workout(
        session, signed_in, split["days"][2]["id"], datetime(2026, 10, 9, 18, tzinfo=UTC)
    )

    week = {
        "2026-10-05": "Full body A",  # Monday
        "2026-10-06": None,
        "2026-10-07": "Full body B",  # Wednesday
        "2026-10-08": None,
        "2026-10-09": "Full body C",  # Friday
        "2026-10-10": None,
        "2026-10-11": None,
    }
    for on, expected in week.items():
        assert await next_day_name(client, signed_in, split["id"], on) == expected, on


async def test_next_day_needs_an_owned_split_and_a_date(
    client: AsyncClient, signed_in: SignedIn, other_user: SignedIn, library: None
) -> None:
    theirs = await from_preset(client, other_user, "arnold")
    response = await client.get(
        f"/splits/{theirs['id']}/next-day", headers=signed_in.headers, params={"on": "2026-10-09"}
    )
    assert response.status_code == 404

    mine = await from_preset(client, signed_in, "arnold")
    assert (
        await client.get(f"/splits/{mine['id']}/next-day", headers=signed_in.headers)
    ).status_code == 422


async def test_split_pulls_are_scoped_to_the_user(
    client: AsyncClient,
    session: AsyncSession,
    signed_in: SignedIn,
    other_user: SignedIn,
    library: None,
) -> None:
    await from_preset(client, signed_in, "arnold")
    await from_preset(client, other_user, "body_part")

    splits = (await client.get("/splits", headers=signed_in.headers)).json()
    days = (await client.get("/split-days", headers=signed_in.headers)).json()
    rows = (await client.get("/split-day-exercises", headers=signed_in.headers)).json()

    assert [s["name"] for s in splits] == ["Arnold split"]
    assert len(days) == 3
    assert len(rows) == 17
    total = await session.scalar(select(func.count()).select_from(SplitDayExercise))
    assert total == 17 + sum(len(d.exercises) for d in PRESETS["body_part"].days)
    assert await session.scalar(select(func.count()).select_from(Split)) == 2
