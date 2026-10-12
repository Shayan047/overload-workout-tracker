"""Stats endpoints against the product-spec sample, stored in kg and read back in lb."""

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.seed.exercises import library_exercise_id, seed_exercises
from tests.conftest import SignedIn

pytestmark = pytest.mark.anyio

LB = 0.45359237
CURL = str(library_exercise_id("Dumbbell_Bicep_Curl"))
CHIN_UP = str(library_exercise_id("Chin-Up"))

SAMPLE = [  # bicep curl, from docs/product-spec.md
    ("2026-08-18", 10, [12, 8, 7, 7]),
    ("2026-08-21", 10, [12, 9, 9, 8]),
    ("2026-08-25", 10, [12, 10, 9, 9]),
    ("2026-08-28", 10, [13, 11, 10, 10]),
    ("2026-09-01", 10, [14, 12, 11, 11]),
    ("2026-09-28", 15, [12, 10, 9, 9]),
    ("2026-10-06", 20, [6, 5, 5, 4]),
    ("2026-10-09", 20, [7, 6, 6, 5]),
]


def lb(kg: float) -> float:
    return round(kg / LB, 1)


async def log_workout(
    client: AsyncClient,
    who: SignedIn,
    day: str,
    exercise_id: str,
    weight_lb: float,
    reps: list[int],
    *,
    finished: bool = True,
    bodyweight_kg: float = 78,
) -> str:
    workout_id = str(uuid.uuid4())
    body: dict[str, Any] = {
        "title": "Arms",
        "started_at": f"{day}T18:00:00Z",
        "bodyweight_kg": bodyweight_kg,
    }
    if finished:
        body["ended_at"] = f"{day}T19:00:00Z"
    assert (
        await client.put(f"/workouts/{workout_id}", headers=who.headers, json=body)
    ).status_code == 200
    row_id = str(uuid.uuid4())
    await client.put(
        f"/workout-exercises/{row_id}",
        headers=who.headers,
        json={
            "workout_id": workout_id,
            "exercise_id": exercise_id,
            "position": 0,
            "rest_seconds": 90,
        },
    )
    for number, count in enumerate(reps, start=1):
        response = await client.put(
            f"/sets/{uuid.uuid4()}",
            headers=who.headers,
            json={
                "workout_exercise_id": row_id,
                "set_number": number,
                "weight_kg": weight_lb * LB,
                "reps": count,
                "logged_at": f"{day}T18:{10 + number:02d}:00Z",
            },
        )
        assert response.status_code == 200, response.text
    return workout_id


@pytest.fixture
async def sample(client: AsyncClient, session: AsyncSession, signed_in: SignedIn) -> None:
    await seed_exercises(session)
    for day, weight, reps in SAMPLE:
        await log_workout(client, signed_in, day, CURL, weight, reps)


async def get(client: AsyncClient, who: SignedIn, path: str, **params: str) -> Any:
    response = await client.get(path, headers=who.headers, params=params)
    assert response.status_code == 200, response.text
    return response.json()


async def test_exercise_detail_matches_the_sample(
    client: AsyncClient, signed_in: SignedIn, sample: None
) -> None:
    stats = await get(client, signed_in, f"/stats/exercises/{CURL}")

    assert stats["includes_bodyweight"] is False
    assert lb(stats["est_max_kg"]) == 24.7
    assert [lb(p["est_max_kg"]) for p in stats["series"][-3:]] == [21.0, 24.0, 24.7]
    assert lb(stats["est_max_kg"] - stats["first"]["est_max_kg"]) == 10.7
    assert stats["first"]["at"] == "2026-08-18T18:00:00Z"
    assert stats["is_new_best"] is True
    assert [(lb(p["weight_kg"]), p["reps"]) for p in stats["frontier"]] == [
        (10, 14),
        (15, 12),
        (20, 7),
    ]
    assert [(lb(w["weight_kg"]), w["sessions"]) for w in stats["weights"]] == [
        (10, 5),
        (15, 1),
        (20, 2),
    ]
    assert (lb(stats["best_set"]["weight_kg"]), stats["best_set"]["reps"]) == (20, 7)
    assert (lb(stats["most_reps"]["weight_kg"]), stats["most_reps"]["reps"]) == (10, 14)
    assert stats["most_reps"]["at"] == "2026-09-01T18:00:00Z"
    assert (lb(stats["heaviest"]["weight_kg"]), stats["heaviest"]["first_at"]) == (
        20,
        "2026-10-06T18:00:00Z",
    )
    assert stats["plateau"] is None
    assert stats["projection"]["at"] == "2026-12-04T18:00:00Z"
    assert lb(stats["projection"]["est_max_kg"]) == 27.6
    latest = stats["series"][-1]
    assert [(lb(s["weight_kg"]), s["reps"]) for s in latest["sets"]] == [
        (20, 7),
        (20, 6),
        (20, 6),
        (20, 5),
    ]
    assert (lb(latest["best_set"]["weight_kg"]), latest["best_set"]["reps"]) == (20, 7)


async def test_one_weight_view_matches_the_sample(
    client: AsyncClient, signed_in: SignedIn, sample: None
) -> None:
    ten_lb_kg = round(10 * LB, 3)  # 4.536, as stored
    stats = await get(client, signed_in, f"/stats/exercises/{CURL}/weights/{ten_lb_kg}")

    sessions = stats["sessions"]
    assert [s["reps"] for s in sessions] == [r for _, w, r in SAMPLE if w == 10]
    assert [s["total"] for s in sessions] == [34, 38, 40, 44, 48]
    assert [s["average"] for s in sessions] == [8.5, 9.5, 10.0, 11.0, 12.0]
    assert [round(s["retention"] * 100) for s in sessions] == [58, 67, 75, 77, 79]
    assert stats["total_change"] == 14  # "+14 more reps per workout, from 34 to 48"
    assert round(stats["first_retention"] * 100) == 58
    assert round(stats["latest_retention"] * 100) == 79
    assert stats["moved_up_on"] == "2026-09-28T18:00:00Z"

    # The weight in the path is matched after rounding to the gram, like stored weights.
    assert (await get(client, signed_in, f"/stats/exercises/{CURL}/weights/{10 * LB}"))[
        "sessions"
    ] == sessions
    assert (await get(client, signed_in, f"/stats/exercises/{CURL}/weights/5"))["sessions"] == []


async def test_frontier_as_of_earlier_dates(
    client: AsyncClient, signed_in: SignedIn, sample: None
) -> None:
    path = f"/stats/exercises/{CURL}/frontier"

    now = await get(client, signed_in, path)
    sep_15 = await get(client, signed_in, path, as_of="2026-09-15T23:59:59Z")
    aug_18 = await get(client, signed_in, path, as_of="2026-08-18T23:59:59Z")

    assert [(lb(p["weight_kg"]), p["reps"]) for p in now["points"]] == [(10, 14), (15, 12), (20, 7)]
    assert [(lb(p["weight_kg"]), p["reps"]) for p in sep_15["points"]] == [(10, 14)]
    assert [(lb(p["weight_kg"]), p["reps"]) for p in aug_18["points"]] == [(10, 12)]


async def test_progress_list(client: AsyncClient, signed_in: SignedIn, sample: None) -> None:
    # Chin-ups: best on Sep 7, then three weeks of lighter sessions.
    await log_workout(client, signed_in, "2026-09-07", CHIN_UP, 25, [8], bodyweight_kg=78)
    for day in ("2026-09-14", "2026-09-21", "2026-09-30"):
        await log_workout(client, signed_in, day, CHIN_UP, 20, [8], bodyweight_kg=78)

    items = await get(client, signed_in, "/stats/progress", as_of="2026-10-09T20:00:00Z")

    assert [i["exercise_id"] for i in items] == [CURL, CHIN_UP]  # most recently trained first
    curl, chin_up = items
    assert lb(curl["est_max_kg"]) == 24.7
    assert round(curl["change"] * 100) == 76
    assert curl["is_new_best"] is True
    assert curl["plateau"] is None
    assert len(curl["sparkline"]) == 8
    assert curl["latest_at"] == "2026-10-09T18:00:00Z"

    assert chin_up["includes_bodyweight"] is True
    expected = (78 + 25 * LB) * (1 + 8 / 30)
    assert chin_up["est_max_kg"] == pytest.approx((78 + 20 * LB) * (1 + 8 / 30), abs=1e-3)
    assert chin_up["plateau"]["weeks_flat"] == 3
    assert chin_up["plateau"]["best_kg"] == pytest.approx(expected, abs=1e-3)
    assert chin_up["is_new_best"] is False


async def test_stats_ignore_unfinished_and_deleted_workouts_and_other_users(
    client: AsyncClient, signed_in: SignedIn, other_user: SignedIn, sample: None
) -> None:
    deleted = await log_workout(client, signed_in, "2026-10-10", CURL, 50, [10])
    await client.delete(f"/workouts/{deleted}", headers=signed_in.headers)
    await log_workout(client, signed_in, "2026-10-11", CURL, 60, [10], finished=False)
    await log_workout(client, other_user, "2026-10-11", CURL, 70, [10])

    stats = await get(client, signed_in, f"/stats/exercises/{CURL}")
    assert lb(stats["est_max_kg"]) == 24.7
    assert len(stats["series"]) == 8

    theirs = await get(client, other_user, f"/stats/exercises/{CURL}")
    assert len(theirs["series"]) == 1
    assert [i["exercise_id"] for i in await get(client, other_user, "/stats/progress")] == [CURL]


async def test_stats_for_an_exercise_never_done_or_not_visible(
    client: AsyncClient, signed_in: SignedIn, other_user: SignedIn, sample: None
) -> None:
    empty = await get(client, signed_in, f"/stats/exercises/{CHIN_UP}")
    assert (empty["est_max_kg"], empty["series"], empty["frontier"], empty["projection"]) == (
        None,
        [],
        [],
        None,
    )

    secret = str(uuid.uuid4())
    await client.put(
        f"/exercises/{secret}",
        headers=other_user.headers,
        json={"name": "Secret", "primary_muscle": "chest", "kind": "weighted"},
    )
    for path in (f"/stats/exercises/{secret}", f"/stats/exercises/{uuid.uuid4()}/frontier"):
        assert (await client.get(path, headers=signed_in.headers)).status_code == 404
