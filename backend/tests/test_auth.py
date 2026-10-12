import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token
from app.models import User, UserSettings
from tests.conftest import SignedIn

pytestmark = pytest.mark.anyio


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_protected_route_returns_the_signed_in_user(
    client: AsyncClient, signed_in: SignedIn
) -> None:
    response = await client.get("/me", headers=signed_in.headers)

    assert response.status_code == 200
    assert response.json() == {
        "id": str(signed_in.user_id),
        "email": "lifter@example.com",
        "display_name": None,
    }


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer not-a-jwt"},
        {"Authorization": "Basic dXNlcjpwYXNz"},
    ],
    ids=["no token", "garbage token", "wrong scheme"],
)
async def test_protected_route_rejects_missing_or_bad_tokens(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    response = await client.get("/me", headers=headers)

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


async def test_protected_route_rejects_expired_token(
    client: AsyncClient, signed_in: SignedIn
) -> None:
    long_ago = datetime.now(UTC) - timedelta(days=365)
    token = create_access_token(signed_in.user_id, now=long_ago)

    assert (await client.get("/me", headers=bearer(token))).status_code == 401


async def test_protected_route_rejects_token_signed_with_another_secret(
    client: AsyncClient, signed_in: SignedIn
) -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": str(signed_in.user_id), "iat": now, "exp": now + timedelta(days=1)},
        "some-other-secret-some-other-secret-0123",
        algorithm="HS256",
    )

    assert (await client.get("/me", headers=bearer(token))).status_code == 401


async def test_protected_route_rejects_unknown_or_deleted_user(
    client: AsyncClient, session: AsyncSession, signed_in: SignedIn
) -> None:
    unknown = create_access_token(uuid.uuid4())
    assert (await client.get("/me", headers=bearer(unknown))).status_code == 401

    await session.execute(
        update(User).where(User.id == signed_in.user_id).values(deleted_at=datetime.now(UTC))
    )
    assert (await client.get("/me", headers=signed_in.headers)).status_code == 401


async def test_sign_up_stores_a_normalized_email_hashed_password_and_settings(
    client: AsyncClient, session: AsyncSession
) -> None:
    response = await client.post(
        "/auth/sign-up",
        json={
            "email": "  Shayan@Example.COM ",
            "password": "correct horse",
            "display_name": "Shayan",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "shayan@example.com"
    assert body["user"]["display_name"] == "Shayan"

    user = await session.get_one(User, uuid.UUID(body["user"]["id"]))
    assert user.password_hash.startswith("$argon2id$")
    assert "correct horse" not in user.password_hash
    settings = await session.scalar(select(UserSettings).where(UserSettings.user_id == user.id))
    assert settings is not None and settings.unit == "lb"


async def test_sign_up_rejects_an_email_already_used_in_any_case(
    client: AsyncClient, signed_in: SignedIn
) -> None:
    response = await client.post(
        "/auth/sign-up", json={"email": "LIFTER@example.com", "password": "another password"}
    )

    assert response.status_code == 409


@pytest.mark.parametrize(
    "body",
    [
        {"email": "not-an-email", "password": "correct horse"},
        {"email": "a@b.co", "password": "short"},
        {"email": "a@b.co"},
    ],
    ids=["bad email", "short password", "missing password"],
)
async def test_sign_up_validates_input(client: AsyncClient, body: dict[str, str]) -> None:
    assert (await client.post("/auth/sign-up", json=body)).status_code == 422


async def test_sign_in_returns_a_token_that_works(client: AsyncClient, signed_in: SignedIn) -> None:
    response = await client.post(
        "/auth/sign-in", json={"email": " Lifter@Example.com", "password": "correct horse"}
    )

    assert response.status_code == 200
    token = response.json()["access_token"]
    assert decode_access_token(token) == signed_in.user_id
    assert (await client.get("/me", headers=bearer(token))).status_code == 200


@pytest.mark.parametrize(
    ("email", "password"),
    [("lifter@example.com", "wrong password"), ("nobody@example.com", "correct horse")],
    ids=["wrong password", "unknown email"],
)
async def test_sign_in_rejects_bad_credentials_the_same_way(
    client: AsyncClient, signed_in: SignedIn, email: str, password: str
) -> None:
    response = await client.post("/auth/sign-in", json={"email": email, "password": password})

    assert response.status_code == 401
    assert response.json() == {"detail": "Wrong email or password"}


def test_token_carries_user_id_and_expiry() -> None:
    user_id = uuid.uuid4()
    now = datetime(2026, 10, 11, tzinfo=UTC)
    token = create_access_token(user_id, now=now)
    claims = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})

    assert claims["sub"] == str(user_id)
    ttl = timedelta(days=get_settings().access_token_ttl_days)
    assert claims["exp"] - claims["iat"] == ttl.total_seconds()
