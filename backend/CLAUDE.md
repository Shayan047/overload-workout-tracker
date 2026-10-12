# Backend (FastAPI)

**Status:** exercise library (roadmap chunk 4).

Read the root `../CLAUDE.md` first. Domain rules there apply here too.

## Stack

- Python 3.12+, uv for dependencies.
- FastAPI served by uvicorn, Pydantic v2 with pydantic-settings.
- SQLAlchemy 2 (async) with asyncpg, Alembic.
- pwdlib[argon2] for password hashing, PyJWT for access tokens.
- PostgreSQL in Docker Compose.
- pytest with httpx (`AsyncClient` + `ASGITransport`, async tests via the anyio plugin), ruff.

Ask before adding anything not on this list.

## Commands

Run from `backend/`.

```
docker compose up -d --build       # Postgres + API on http://localhost:8000 (runs migrations first)
docker compose up -d db            # Postgres only, for running the API on the host
uv sync                            # install dependencies into .venv
uv run uvicorn app.main:app --reload
uv run pytest
uv run ruff check . && uv run ruff format .
uv run alembic revision --autogenerate -m "..."
uv run alembic upgrade head
uv run python -m app.seed          # load/refresh the exercise library (idempotent)
```

Copy `.env.example` to `.env` for host runs. The Compose project is named `overload`.

Tests need Postgres running (`docker compose up -d db`). They use a separate
`<database>_test` database that is dropped, recreated and migrated up, down and up again
at the start of each run; each test runs in a transaction that is rolled back.
`test_migration_matches_models` fails if the models and migrations drift apart.

New migrations: generate with `--autogenerate`, then read and fix the file by hand
(a ruff post-write hook formats it).

## Layout

```
app/main.py
app/core/         config, security
app/db/           engine, session, base
app/models/       SQLAlchemy models
app/schemas/      Pydantic request/response models
app/api/routes/   routers
app/services/     business logic that touches the database
app/stats/        pure functions, no database access
tests/
```

## Rules

- Every schema change is an Alembic migration, and an applied migration is never edited.
- Every query is scoped to the current user. Protected routes take `user: CurrentUser` and
  `session: SessionDep` from `app/api/deps.py`.
- Accept client-generated UUIDs. All writes are idempotent PUT upserts through
  `app/services/sync.py` (`upsert`, `soft_delete`, `pull_filter`); don't hand-roll them.
- Soft deletes use `deleted_at`, and list endpoints support `updated_since`.
- Weights are stored in kg as NUMERIC(7,3).
- User-owned models use `UserOwnedMixin` and add `sync_index(table)` to `__table_args__`.
- The stats module stays pure and unit tested (tests use the sample data in
  `../docs/product-spec.md`).
- Secrets come only from environment variables. `.env` is never committed;
  `.env.example` documents the variables.

Details: `../docs/data-model.md`, `../docs/api-and-sync.md`.
