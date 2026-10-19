"""DATABASE_URL as hosts give it (Neon, Render) becomes one asyncpg can use."""

import pytest

from app.core.config import Settings, normalize_database_url

NEON = (
    "postgresql://overload_owner:secret@ep-cool-sun-a1b2c3d4-pooler.ap-southeast-1.aws.neon.tech"
    "/neondb?sslmode=require&channel_binding=require"
)


def test_neon_string_as_pasted() -> None:
    assert normalize_database_url(NEON) == (
        "postgresql+asyncpg://overload_owner:secret@ep-cool-sun-a1b2c3d4.ap-southeast-1.aws.neon.tech"
        "/neondb?ssl=require"
    )


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ("postgres://u:p@host/db", "postgresql+asyncpg://u:p@host/db"),
        ("postgresql://u:p@host:5433/db", "postgresql+asyncpg://u:p@host:5433/db"),
        (
            "postgresql+asyncpg://overload:overload@localhost:5432/overload",
            "postgresql+asyncpg://overload:overload@localhost:5432/overload",
        ),
        (
            "postgresql://u:p@host/db?sslmode=verify-full",
            "postgresql+asyncpg://u:p@host/db?ssl=verify-full",
        ),
        ("postgresql://u:p%40x@host/db", "postgresql+asyncpg://u:p%40x@host/db"),
    ],
)
def test_other_forms(given: str, expected: str) -> None:
    assert normalize_database_url(given) == expected


def test_settings_apply_it(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", NEON)
    assert Settings().database_url.startswith("postgresql+asyncpg://")
