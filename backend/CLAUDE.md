# Backend (FastAPI)

**Status:** skeleton (roadmap chunk 1): app, settings, Docker Compose, Alembic, pytest, `/health`.

Read the root `../CLAUDE.md` first. Domain rules there apply here too.

## Stack

- Python 3.12+, uv for dependencies.
- FastAPI served by uvicorn, Pydantic v2 with pydantic-settings.
- SQLAlchemy 2 (async) with asyncpg, Alembic.
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
```

Copy `.env.example` to `.env` for host runs. The Compose project is named `overload`.

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
- Every query is scoped to the current user.
- Accept client-generated UUIDs. All writes are idempotent PUT upserts.
- Soft deletes use `deleted_at`, and list endpoints support `updated_since`.
- Weights are stored in kg as NUMERIC(7,3).
- The stats module stays pure and unit tested (tests use the sample data in
  `../docs/product-spec.md`).
- Secrets come only from environment variables. `.env` is never committed;
  `.env.example` documents the variables.

Details: `../docs/data-model.md`, `../docs/api-and-sync.md`.
