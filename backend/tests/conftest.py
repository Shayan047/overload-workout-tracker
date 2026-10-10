import asyncio
import os
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import get_settings

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Tests run against "<database>_test" on the same server, never the dev database.
# Point DATABASE_URL at it before the app (and its engine) is imported.
_url = make_url(get_settings().database_url)
if not _url.database.endswith("_test"):
    _url = _url.set(database=f"{_url.database}_test")
TEST_DATABASE_URL = _url
os.environ["DATABASE_URL"] = TEST_DATABASE_URL.render_as_string(hide_password=False)
get_settings.cache_clear()


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _recreate_test_database() -> None:
    name = TEST_DATABASE_URL.database
    admin = create_async_engine(
        TEST_DATABASE_URL.set(database="postgres"), isolation_level="AUTOCOMMIT"
    )
    try:
        async with admin.connect() as conn:
            await conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
            await conn.execute(text(f'CREATE DATABASE "{name}"'))
    except OSError as exc:
        raise RuntimeError(
            f"Postgres is not reachable at {TEST_DATABASE_URL.render_as_string()}. "
            "Start it with `docker compose up -d db`."
        ) from exc
    finally:
        await admin.dispose()


@pytest.fixture(scope="session")
def migrated_database() -> None:
    """A fresh, empty test database, migrated up, fully down and up again."""
    asyncio.run(_recreate_test_database())
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    command.upgrade(config, "head")
    command.downgrade(config, "base")
    command.upgrade(config, "head")


@pytest.fixture
async def session(migrated_database: None) -> AsyncIterator[AsyncSession]:
    """A session inside a transaction that is rolled back after the test."""
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.connect() as conn:
        transaction = await conn.begin()
        session = AsyncSession(
            bind=conn, join_transaction_mode="create_savepoint", expire_on_commit=False
        )
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()
    await engine.dispose()
