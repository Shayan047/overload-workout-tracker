import pytest
from httpx import AsyncClient

from app.core.config import Settings

pytestmark = pytest.mark.anyio

EXPO_WEB = "http://localhost:8081"


async def test_preflight_from_the_expo_web_dev_server_is_allowed(client: AsyncClient) -> None:
    response = await client.options(
        "/auth/sign-up",
        headers={
            "Origin": EXPO_WEB,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type, authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == EXPO_WEB
    assert "POST" in response.headers["access-control-allow-methods"]
    allowed_headers = response.headers["access-control-allow-headers"].lower()
    assert "authorization" in allowed_headers
    assert "content-type" in allowed_headers
    # Tokens travel in the Authorization header, never in cookies.
    assert "access-control-allow-credentials" not in response.headers


async def test_responses_to_an_allowed_origin_carry_the_header(client: AsyncClient) -> None:
    response = await client.get("/health", headers={"Origin": EXPO_WEB})

    assert response.headers["access-control-allow-origin"] == EXPO_WEB


async def test_other_origins_are_not_allowed(client: AsyncClient) -> None:
    preflight = await client.options(
        "/auth/sign-in",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    response = await client.get("/health", headers={"Origin": "https://evil.example"})

    assert "access-control-allow-origin" not in preflight.headers
    assert "access-control-allow-origin" not in response.headers


def test_cors_origins_come_from_a_comma_separated_setting() -> None:
    settings = Settings(cors_origins=" https://app.example.com , http://localhost:8081 ,")

    assert settings.cors_origin_list == ["https://app.example.com", "http://localhost:8081"]
    assert Settings(cors_origins="").cors_origin_list == []
