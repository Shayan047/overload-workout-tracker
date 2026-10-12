import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.seed.exercises import library_exercise_id, seed_exercises
from tests.conftest import SignedIn, just_before

pytestmark = pytest.mark.anyio

CURL = str(library_exercise_id("Dumbbell_Bicep_Curl"))
CHIN_UP = str(library_exercise_id("Chin-Up"))
HAMMER = str(library_exercise_id("Hammer_Curls"))
EZ_CURL = str(library_exercise_id("EZ-Bar_Curl"))
CABLE_CURL = str(library_exercise_id("High_Cable_Curls"))

TEN_LB = 4.5359237
TWENTY_LB = 9.0718474


@pytest.fixture
async def arnold(client: AsyncClient, session: AsyncSession, signed_in: SignedIn) -> dict[str, Any]:
    await seed_exercises(session)
    response = await client.post(
        f"/splits/{uuid.uuid4()}/from-preset", headers=signed_in.headers, json={"preset": "arnold"}
    )
    await client.put(
        f"/bodyweight-entries/{uuid.uuid4()}",
        headers=signed_in.headers,
        json={"weight_kg": 78.018, "measured_on": "2026-10-01"},
    )
    return response.json()


class Outbox:
    """Records writes so a test can send them again, like the phone's outbox would."""

    def __init__(
        self, client: AsyncClient, who: SignedIn, send_twice: AsyncSession | None = None
    ) -> None:
        """With `send_twice`, every PUT is sent again right away (as after a lost response)
        and the test fails if the second send rewrote any row."""
        self.client, self.who, self.send_twice = client, who, send_twice
        self.sent: list[tuple[str, str, dict[str, Any] | None]] = []

    async def put(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        self.sent.append(("PUT", path, body))
        response = await self.client.put(path, headers=self.who.headers, json=body)
        assert response.status_code == 200, (path, response.text)
        if self.send_twice is not None:
            rows = await physical_rows(self.send_twice)
            again = await self.client.put(path, headers=self.who.headers, json=body)
            assert again.json() == response.json(), path
            assert await physical_rows(self.send_twice) == rows, f"{path} was rewritten"
        return response.json()

    async def delete(self, path: str) -> None:
        self.sent.append(("DELETE", path, None))
        response = await self.client.delete(path, headers=self.who.headers)
        assert response.status_code == 204, (path, response.text)

    async def replay(self) -> None:
        for method, path, body in list(self.sent):
            response = await self.client.request(method, path, headers=self.who.headers, json=body)
            assert response.status_code in (200, 204), (path, response.text)


async def start_shoulders_and_arms(outbox: Outbox, arnold: dict[str, Any]) -> dict[str, Any]:
    """Starts day 2 the way the phone does: the workout, then one row per split exercise."""
    day = arnold["days"][1]
    workout_id = str(uuid.uuid4())
    workout = await outbox.put(
        f"/workouts/{workout_id}",
        {"split_day_id": day["id"], "title": day["name"], "started_at": "2026-10-09T18:12:00Z"},
    )
    rows = []
    for planned in day["exercises"]:
        rows.append(
            await outbox.put(
                f"/workout-exercises/{uuid.uuid4()}",
                {
                    "workout_id": workout_id,
                    "exercise_id": planned["exercise_id"],
                    "position": planned["position"],
                    "rest_seconds": planned["rest_seconds"],
                },
            )
        )
    return {"workout": workout, "rows": rows}


async def log_set(
    outbox: Outbox, row: dict[str, Any], number: int, weight_kg: float, reps: int
) -> dict[str, Any]:
    return await outbox.put(
        f"/sets/{uuid.uuid4()}",
        {
            "workout_exercise_id": row["id"],
            "set_number": number,
            "weight_kg": weight_kg,
            "reps": reps,
            "logged_at": f"2026-10-09T18:{20 + number:02d}:00Z",
        },
    )


async def physical_rows(session: AsyncSession) -> dict[str, str]:
    """id -> ctid for every workout row. A row's ctid changes whenever it is rewritten, even
    inside one transaction, so equal snapshots mean nothing was written."""
    result = await session.execute(
        text(
            "SELECT id::text, ctid::text FROM workouts UNION ALL "
            "SELECT id::text, ctid::text FROM workout_exercises UNION ALL "
            "SELECT id::text, ctid::text FROM sets"
        )
    )
    return dict(result.all())


async def pull_everything(client: AsyncClient, who: SignedIn) -> dict[str, Any]:
    return {
        path: (await client.get(path, headers=who.headers)).json()
        for path in ("/workouts", "/workout-exercises", "/sets", "/bodyweight-entries")
    }


async def test_replaying_the_same_puts_changes_nothing(
    client: AsyncClient, session: AsyncSession, signed_in: SignedIn, arnold: dict[str, Any]
) -> None:
    outbox = Outbox(client, signed_in, send_twice=session)
    started = await start_shoulders_and_arms(outbox, arnold)
    curl = started["rows"][2]
    for number, reps in enumerate([7, 6, 6, 5], start=1):
        await log_set(outbox, curl, number, TWENTY_LB, reps)
    await outbox.put(f"/workout-exercises/{curl['id']}", curl | {"status": "done"})
    workout = started["workout"]
    await outbox.put(
        f"/workouts/{workout['id']}",
        {
            "split_day_id": workout["split_day_id"],
            "title": workout["title"],
            "started_at": workout["started_at"],
            "ended_at": "2026-10-09T18:59:00Z",
        },
    )
    before = await pull_everything(client, signed_in)

    # Sending the whole outbox again ends in the same state, with no duplicates, and the
    # replayed start does not reopen the finished workout.
    await outbox.replay()
    assert await pull_everything(client, signed_in) == before
    assert before["/workouts"][0]["ended_at"] == "2026-10-09T18:59:00Z"
    assert len(before["/sets"]) == 4


async def test_resume_returns_the_workout_in_progress(
    client: AsyncClient, signed_in: SignedIn, other_user: SignedIn, arnold: dict[str, Any]
) -> None:
    assert (await client.get("/workouts/in-progress", headers=signed_in.headers)).json() is None

    outbox = Outbox(client, signed_in)
    started = await start_shoulders_and_arms(outbox, arnold)
    curl = started["rows"][2]
    await log_set(outbox, curl, 1, TWENTY_LB, 7)
    await log_set(outbox, curl, 2, TWENTY_LB, 6)

    resumed = (await client.get("/workouts/in-progress", headers=signed_in.headers)).json()
    assert resumed["id"] == started["workout"]["id"]
    assert resumed["ended_at"] is None
    assert resumed["bodyweight_kg"] == 78.018  # snapshot taken from the latest entry
    assert [e["exercise_id"] for e in resumed["exercises"]] == [
        e["exercise_id"] for e in arnold["days"][1]["exercises"]
    ]
    assert [
        (s["set_number"], s["weight_kg"], s["reps"]) for s in resumed["exercises"][2]["sets"]
    ] == [
        (1, 9.072, 7),
        (2, 9.072, 6),
    ]
    assert (await client.get("/workouts/in-progress", headers=other_user.headers)).json() is None

    workout = started["workout"]
    await outbox.put(
        f"/workouts/{workout['id']}",
        {
            "title": workout["title"],
            "started_at": workout["started_at"],
            "ended_at": "2026-10-09T19:00:00Z",
        },
    )
    assert (await client.get("/workouts/in-progress", headers=signed_in.headers)).json() is None


async def test_only_one_workout_can_be_in_progress(
    client: AsyncClient, signed_in: SignedIn, arnold: dict[str, Any]
) -> None:
    started = await start_shoulders_and_arms(Outbox(client, signed_in), arnold)

    second = await client.put(
        f"/workouts/{uuid.uuid4()}",
        headers=signed_in.headers,
        json={"title": "Legs", "started_at": "2026-10-09T19:00:00Z"},
    )

    assert second.status_code == 409
    assert second.json()["detail"]["in_progress_workout_id"] == started["workout"]["id"]


async def test_today_only_changes_leave_the_split_untouched(
    client: AsyncClient, session: AsyncSession, signed_in: SignedIn, arnold: dict[str, Any]
) -> None:
    split_before = (await client.get(f"/splits/{arnold['id']}", headers=signed_in.headers)).json()
    split_rows = text("SELECT id::text, ctid::text FROM split_day_exercises ORDER BY id")
    physical_before = (await session.execute(split_rows)).all()

    outbox = Outbox(client, signed_in)
    rows = (await start_shoulders_and_arms(outbox, arnold))["rows"]
    workout_id = rows[0]["workout_id"]
    hammer, pushdown, chin_up = rows[3], rows[4], rows[5]

    # Swap hammer curls for EZ-bar curls, skip pushdowns, move chin-ups to the end,
    # and add cable curls with their own rest length.
    await outbox.put(
        f"/workout-exercises/{hammer['id']}", hammer | {"exercise_id": EZ_CURL, "source": "swapped"}
    )
    await outbox.put(f"/workout-exercises/{pushdown['id']}", pushdown | {"status": "skipped"})
    await outbox.put(f"/workout-exercises/{chin_up['id']}", chin_up | {"position": 7})
    await outbox.put(
        f"/workout-exercises/{uuid.uuid4()}",
        {
            "workout_id": workout_id,
            "exercise_id": CABLE_CURL,
            "position": 6,
            "source": "added",
            "rest_seconds": 75,
        },
    )

    today = (await client.get(f"/workouts/{workout_id}", headers=signed_in.headers)).json()
    assert [
        (e["exercise_id"], e["status"], e["source"], e["rest_seconds"]) for e in today["exercises"]
    ] == [
        (rows[0]["exercise_id"], "planned", "split", 150),
        (rows[1]["exercise_id"], "planned", "split", 60),
        (CURL, "planned", "split", 90),
        (EZ_CURL, "planned", "swapped", 90),
        (rows[4]["exercise_id"], "skipped", "split", 60),
        (CABLE_CURL, "planned", "added", 75),
        (CHIN_UP, "planned", "split", 120),
    ]

    assert (
        await client.get(f"/splits/{arnold['id']}", headers=signed_in.headers)
    ).json() == split_before
    assert (await session.execute(split_rows)).all() == physical_before


async def test_pulls_return_soft_deleted_rows(
    client: AsyncClient, signed_in: SignedIn, arnold: dict[str, Any]
) -> None:
    outbox = Outbox(client, signed_in)
    started = await start_shoulders_and_arms(outbox, arnold)
    curl = started["rows"][2]
    keep = await log_set(outbox, curl, 1, TWENTY_LB, 7)
    mistake = await log_set(outbox, curl, 2, TWENTY_LB, 60)
    since = just_before(started["workout"]["created_at"])

    await outbox.delete(f"/sets/{mistake['id']}")

    assert [s["id"] for s in (await client.get("/sets", headers=signed_in.headers)).json()] == [
        keep["id"]
    ]
    pulled = (
        await client.get("/sets", headers=signed_in.headers, params={"updated_since": since})
    ).json()
    assert {s["id"]: s["deleted_at"] is not None for s in pulled} == {
        keep["id"]: False,
        mistake["id"]: True,
    }

    # Deleting the workout takes its exercises and sets with it, and pulls say so.
    await outbox.delete(f"/workouts/{started['workout']['id']}")
    for path in ("/workouts", "/workout-exercises", "/sets"):
        assert (await client.get(path, headers=signed_in.headers)).json() == []
        pulled = (
            await client.get(path, headers=signed_in.headers, params={"updated_since": since})
        ).json()
        assert pulled and all(row["deleted_at"] is not None for row in pulled), path
    assert (await client.get("/workouts/in-progress", headers=signed_in.headers)).json() is None


async def test_bodyweight_snapshot_never_follows_later_entries(
    client: AsyncClient, signed_in: SignedIn, arnold: dict[str, Any]
) -> None:
    outbox = Outbox(client, signed_in)
    started = await start_shoulders_and_arms(outbox, arnold)
    assert started["workout"]["bodyweight_kg"] == 78.018

    await outbox.put(
        f"/bodyweight-entries/{uuid.uuid4()}", {"weight_kg": 80.5, "measured_on": "2026-10-10"}
    )
    workout = (
        await client.get(f"/workouts/{started['workout']['id']}", headers=signed_in.headers)
    ).json()
    assert workout["bodyweight_kg"] == 78.018

    # An explicit snapshot is used as sent, and omitting it later keeps the stored one.
    explicit = await outbox.put(
        f"/workouts/{uuid.uuid4()}",
        {
            "title": "Legs",
            "started_at": "2026-10-08T18:00:00Z",
            "ended_at": "2026-10-08T19:00:00Z",
            "bodyweight_kg": 77,
        },
    )
    assert explicit["bodyweight_kg"] == 77.0
    again = await outbox.put(
        f"/workouts/{explicit['id']}",
        {
            "title": "Legs!",
            "started_at": "2026-10-08T18:00:00Z",
            "ended_at": "2026-10-08T19:00:00Z",
        },
    )
    assert (again["title"], again["bodyweight_kg"]) == ("Legs!", 77.0)


async def test_starting_without_any_bodyweight_is_rejected(
    client: AsyncClient, signed_in: SignedIn
) -> None:
    response = await client.put(
        f"/workouts/{uuid.uuid4()}",
        headers=signed_in.headers,
        json={"title": "Legs", "started_at": "2026-10-09T18:00:00Z"},
    )
    assert response.status_code == 422


async def test_last_sessions_return_the_latest_finished_workout_per_exercise(
    client: AsyncClient, signed_in: SignedIn, arnold: dict[str, Any]
) -> None:
    async def workout(started: str, ended: str | None, curl_sets: list[tuple[float, int]]) -> str:
        outbox = Outbox(client, signed_in)
        workout_id = str(uuid.uuid4())
        await outbox.put(
            f"/workouts/{workout_id}", {"title": "Arms", "started_at": started, "ended_at": ended}
        )
        row = await outbox.put(
            f"/workout-exercises/{uuid.uuid4()}",
            {"workout_id": workout_id, "exercise_id": CURL, "position": 0, "rest_seconds": 90},
        )
        for number, (weight, reps) in enumerate(curl_sets, start=1):
            await log_set(outbox, row, number, weight, reps)
        return workout_id

    await workout("2026-10-02T18:00:00Z", "2026-10-02T19:00:00Z", [(TWENTY_LB, 6), (TWENTY_LB, 5)])
    tuesday = await workout(
        "2026-10-06T18:00:00Z",
        "2026-10-06T19:00:00Z",
        [(TWENTY_LB, 6), (TWENTY_LB, 5), (TWENTY_LB, 5), (TWENTY_LB, 4)],
    )
    await workout("2026-10-07T18:00:00Z", "2026-10-07T19:00:00Z", [])  # curls planned, never done
    await workout("2026-10-09T18:00:00Z", None, [(TWENTY_LB, 7)])  # today, in progress

    response = await client.get(
        "/workouts/last-sessions",
        headers=signed_in.headers,
        params=[("exercise_id", CURL), ("exercise_id", CHIN_UP)],
    )

    assert response.status_code == 200
    sessions = response.json()
    assert len(sessions) == 1  # chin-ups were never done
    ghost = sessions[0]
    assert (ghost["exercise_id"], ghost["workout_id"]) == (CURL, tuesday)
    assert ghost["bodyweight_kg"] == 78.018
    assert [(s["set_number"], s["weight_kg"], s["reps"]) for s in ghost["sets"]] == [
        (1, 9.072, 6),
        (2, 9.072, 5),
        (3, 9.072, 5),
        (4, 9.072, 4),
    ]


async def test_workout_rows_are_validated_and_scoped(
    client: AsyncClient, signed_in: SignedIn, other_user: SignedIn, arnold: dict[str, Any]
) -> None:
    rows = (await start_shoulders_and_arms(Outbox(client, signed_in), arnold))["rows"]
    curl = rows[2]

    def a_set(**change: Any) -> dict[str, Any]:
        return {
            "workout_exercise_id": curl["id"],
            "set_number": 1,
            "weight_kg": 10,
            "reps": 8,
            "logged_at": "2026-10-09T18:30:00Z",
        } | change

    cases = [
        (signed_in, f"/sets/{uuid.uuid4()}", a_set(weight_kg=-1), 422),
        (signed_in, f"/sets/{uuid.uuid4()}", a_set(reps=-1), 422),
        (signed_in, f"/sets/{uuid.uuid4()}", a_set(set_number=0), 422),
        (signed_in, f"/sets/{uuid.uuid4()}", a_set(logged_at="2026-10-09T18:30:00"), 422),
        (other_user, f"/sets/{uuid.uuid4()}", a_set(), 404),
        (
            signed_in,
            f"/workout-exercises/{uuid.uuid4()}",
            {
                "workout_id": curl["workout_id"],
                "exercise_id": str(uuid.uuid4()),
                "position": 0,
                "rest_seconds": 60,
            },
            404,
        ),
        (signed_in, f"/workout-exercises/{curl['id']}", curl | {"status": "half-done"}, 422),
        (signed_in, f"/workout-exercises/{curl['id']}", curl | {"source": "copied"}, 422),
        (
            signed_in,
            f"/workouts/{uuid.uuid4()}",
            {
                "title": "Bad",
                "started_at": "2026-10-09T18:00:00Z",
                "ended_at": "2026-10-09T17:00:00Z",
                "bodyweight_kg": 78,
            },
            422,
        ),
        (
            other_user,
            f"/workouts/{curl['workout_id']}",
            {"title": "Mine", "started_at": "2026-10-09T18:00:00Z", "bodyweight_kg": 70},
            404,
        ),
    ]
    for who, path, body, expected in cases:
        response = await client.put(path, headers=who.headers, json=body)
        assert response.status_code == expected, (path, body, response.text)

    assert (
        await client.get(f"/workouts/{curl['workout_id']}", headers=other_user.headers)
    ).status_code == 404


async def test_weights_are_rounded_to_grams(
    client: AsyncClient, signed_in: SignedIn, arnold: dict[str, Any]
) -> None:
    rows = (await start_shoulders_and_arms(Outbox(client, signed_in), arnold))["rows"]
    logged = await log_set(Outbox(client, signed_in), rows[2], 1, TEN_LB, 12)
    assert logged["weight_kg"] == 4.536
    assert round(logged["weight_kg"] / 0.45359237, 1) == 10.0
