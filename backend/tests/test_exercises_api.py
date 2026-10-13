import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.seed.exercises import seed_exercises
from tests.conftest import SignedIn, just_before

pytestmark = pytest.mark.anyio

CUSTOM = {
    "name": "Cable Y raise",
    "primary_muscle": "shoulders",
    "secondary_muscles": ["traps"],
    "equipment": "cable",
    "kind": "weighted",
}


@pytest.fixture
async def library(session: AsyncSession) -> None:
    await seed_exercises(session)


async def names(client: AsyncClient, who: SignedIn, **params: str) -> list[str]:
    response = await client.get("/exercises", headers=who.headers, params=params)
    assert response.status_code == 200, response.text
    return [e["name"] for e in response.json()]


async def test_signed_out_users_get_the_library_only(
    client: AsyncClient, signed_in: SignedIn, library: None
) -> None:
    # Onboarding picks a split before the account exists, so the library is public.
    custom = await client.put(f"/exercises/{uuid.uuid4()}", headers=signed_in.headers, json=CUSTOM)
    assert custom.status_code == 200

    response = await client.get("/exercises")
    assert response.status_code == 200
    assert len(response.json()) == 739
    assert custom.json()["id"] not in {e["id"] for e in response.json()}
    assert not any(e["is_custom"] for e in response.json())


async def test_a_bad_token_is_still_rejected(client: AsyncClient) -> None:
    # A token that is sent but invalid (expired, forged) means "sign in again", not "public".
    response = await client.get("/exercises", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


async def test_list_returns_the_whole_library(
    client: AsyncClient, signed_in: SignedIn, library: None
) -> None:
    response = await client.get("/exercises", headers=signed_in.headers)

    assert len(response.json()) == 739
    chin_up = next(e for e in response.json() if e["name"] == "Chin-up")
    assert chin_up["muscle_group"] == "back"
    assert chin_up["kind"] == "bodyweight"
    assert chin_up["is_custom"] is False
    assert chin_up["deleted_at"] is None


async def test_search_matches_every_word_and_ranks_prefix_matches_first(
    client: AsyncClient, signed_in: SignedIn, library: None
) -> None:
    curls = await names(client, signed_in, q="curl")
    assert len(curls) > 20
    assert all("curl" in n.lower() for n in curls)

    hammer = await names(client, signed_in, q="hammer curl")
    assert hammer[0] == "Hammer curls"
    assert all("hammer" in n.lower() and "curl" in n.lower() for n in hammer)

    # Hyphens and case don't matter.
    assert "Chin-up" in await names(client, signed_in, q="CHIN UP")
    # LIKE wildcards in the query are literal.
    assert await names(client, signed_in, q="%") == []


async def test_muscle_group_filter_uses_the_primary_muscle(
    client: AsyncClient, signed_in: SignedIn, library: None
) -> None:
    response = await client.get(
        "/exercises", headers=signed_in.headers, params={"muscle_group": "biceps", "q": "curl"}
    )
    found = response.json()

    assert {e["primary_muscle"] for e in found} == {"biceps"}
    assert {"Barbell curl", "EZ-bar curl", "Hammer curls"} <= {e["name"] for e in found}

    back = await client.get(
        "/exercises", headers=signed_in.headers, params={"muscle_group": "back"}
    )
    assert {e["primary_muscle"] for e in back.json()} == {
        "lats",
        "middle back",
        "lower back",
        "traps",
    }

    legs = await client.get(
        "/exercises",
        headers=signed_in.headers,
        params={"muscle_group": "legs", "kind": "bodyweight"},
    )
    assert legs.json() and {e["kind"] for e in legs.json()} == {"bodyweight"}


async def test_unknown_filter_values_are_rejected(client: AsyncClient, signed_in: SignedIn) -> None:
    response = await client.get(
        "/exercises", headers=signed_in.headers, params={"muscle_group": "wings"}
    )
    assert response.status_code == 422


async def test_custom_exercise_is_visible_only_to_its_owner(
    client: AsyncClient, signed_in: SignedIn, other_user: SignedIn, library: None
) -> None:
    exercise_id = uuid.uuid4()
    response = await client.put(f"/exercises/{exercise_id}", headers=signed_in.headers, json=CUSTOM)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(exercise_id)
    assert body["is_custom"] is True
    assert body["muscle_group"] == "shoulders"

    assert "Cable Y raise" in await names(client, signed_in, q="y raise")
    assert "Cable Y raise" not in await names(client, other_user, q="y raise")
    assert len(await names(client, other_user)) == 739

    # The other user can neither change nor delete it.
    hijack = await client.put(
        f"/exercises/{exercise_id}", headers=other_user.headers, json=CUSTOM | {"name": "Mine"}
    )
    assert hijack.status_code == 404
    await client.delete(f"/exercises/{exercise_id}", headers=other_user.headers)
    assert "Cable Y raise" in await names(client, signed_in, q="y raise")


async def test_library_exercises_cannot_be_edited_or_deleted(
    client: AsyncClient, signed_in: SignedIn, library: None
) -> None:
    chin_up = next(
        e
        for e in (await client.get("/exercises", headers=signed_in.headers)).json()
        if e["name"] == "Chin-up"
    )

    edit = await client.put(f"/exercises/{chin_up['id']}", headers=signed_in.headers, json=CUSTOM)
    assert edit.status_code == 404
    await client.delete(f"/exercises/{chin_up['id']}", headers=signed_in.headers)
    assert "Chin-up" in await names(client, signed_in, q="chin-up")


async def test_replaying_a_put_changes_nothing(client: AsyncClient, signed_in: SignedIn) -> None:
    url = f"/exercises/{uuid.uuid4()}"
    first = (await client.put(url, headers=signed_in.headers, json=CUSTOM)).json()
    replay = (await client.put(url, headers=signed_in.headers, json=CUSTOM)).json()

    assert replay == first

    renamed = (
        await client.put(url, headers=signed_in.headers, json=CUSTOM | {"name": "Y raise"})
    ).json()
    assert renamed["name"] == "Y raise"


async def test_delete_is_soft_final_and_shows_up_in_pulls(
    client: AsyncClient, signed_in: SignedIn
) -> None:
    url = f"/exercises/{uuid.uuid4()}"
    created = (await client.put(url, headers=signed_in.headers, json=CUSTOM)).json()

    assert (await client.delete(url, headers=signed_in.headers)).status_code == 204
    assert (await client.delete(url, headers=signed_in.headers)).status_code == 204

    # Gone from a full list, but returned as a tombstone to an incremental pull.
    assert "Cable Y raise" not in await names(client, signed_in)
    pulled = (
        await client.get(
            "/exercises",
            headers=signed_in.headers,
            params={"updated_since": just_before(created["created_at"])},
        )
    ).json()
    tombstone = next(e for e in pulled if e["id"] == created["id"])
    assert tombstone["deleted_at"] is not None

    # A replayed PUT does not bring it back.
    replay = (await client.put(url, headers=signed_in.headers, json=CUSTOM)).json()
    assert replay["deleted_at"] is not None


async def test_deleting_an_unknown_id_is_a_no_op(client: AsyncClient, signed_in: SignedIn) -> None:
    response = await client.delete(f"/exercises/{uuid.uuid4()}", headers=signed_in.headers)
    assert response.status_code == 204


@pytest.mark.parametrize(
    "change",
    [
        {"primary_muscle": "wings"},
        {"secondary_muscles": ["wings"]},
        {"equipment": "spaceship"},
        {"kind": "cardio"},
        {"name": "   "},
    ],
    ids=["muscle", "secondary", "equipment", "kind", "blank name"],
)
async def test_custom_exercise_is_validated(
    client: AsyncClient, signed_in: SignedIn, change: dict[str, object]
) -> None:
    response = await client.put(
        f"/exercises/{uuid.uuid4()}", headers=signed_in.headers, json=CUSTOM | change
    )
    assert response.status_code == 422


async def test_updated_since_needs_a_timezone(client: AsyncClient, signed_in: SignedIn) -> None:
    response = await client.get(
        "/exercises", headers=signed_in.headers, params={"updated_since": "2026-10-11T10:00:00"}
    )
    assert response.status_code == 422
