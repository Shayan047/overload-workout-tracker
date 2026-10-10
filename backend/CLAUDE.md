# Backend (FastAPI)

**Status:** not scaffolded yet; roadmap chunk 1 does it.

Read the root `../CLAUDE.md` first. Domain rules there apply here too.

## Stack

- Python 3.12+, uv for dependencies.
- FastAPI, Pydantic v2 with pydantic-settings.
- SQLAlchemy 2 (async) with asyncpg, Alembic.
- PostgreSQL in Docker Compose.
- pytest with httpx, ruff.

Ask before adding anything not on this list.

## Planned layout

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
