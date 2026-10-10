# API and sync

## Components

- **frontend/:** Expo (React Native, TypeScript) for iOS and Android. Not scaffolded yet.
- **backend/:** FastAPI with PostgreSQL. PostgreSQL is the source of truth from day one.
- **The app never talks to PostgreSQL directly,** only through the API.

```
phone (Expo app)                          server
┌───────────────────────────┐            ┌────────────────┐     ┌────────────┐
│ UI ─► outbox (KV storage) │── PUT ────►│ FastAPI        │────►│ PostgreSQL │
│   ◄── cache  (KV storage) │◄─ GET ─────│  app/stats     │◄────│            │
└───────────────────────────┘            └────────────────┘     └────────────┘
```

## Offline

A user must be able to log a whole workout with no connection.

- **Outbox.** The app keeps an outbox of unsent changes in on-device key-value storage. This is a queue, not a local database.
- **Cache.** The app also caches what it needs to show offline: today's split, last-time data, and recent stats.
- **Sending.** The outbox sends when the connection rules allow. "Sync on Wi-Fi only" is on by default.
- **Status in the UI.** "Saved on this phone" and "Waiting for Wi-Fi" states.
- Every write goes through the outbox and the UI updates immediately. Logging never waits on the network.

## IDs and writes

- UUIDs are generated on the phone, so rows created offline keep their IDs.
- Writes are idempotent upserts: `PUT /resource/{id}`. Replaying the outbox twice is safe.
- The server accepts the client's ID and creates or updates the row.
- Deletes are soft: the row gets `deleted_at` set.

## Pulling changes

- GET list endpoints accept `updated_since` (timestamp).
- Soft-deleted rows come back with `deleted_at` set so the app can remove them.

## Conflicts

- Last write wins per row, by `updated_at`.
- One user on mostly one device makes this enough for now.

## Where stats live

- **Backend, pure Python module (`app/stats`), unit tested:** est. max, frontier, retention, plateau and projection. The app caches the results for offline viewing.
- **Phone, from the cached previous session:** the ghost/last-time comparison and the workout summary, so they work offline.

## Auth

- Email and password sign-up and sign-in, JWT (chunk 3).
- Tokens are stored on the phone in expo-secure-store.
- Every query is scoped to the current user.

## Endpoints

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health` | none | `{"status": "ok"}` (liveness only; does not check the database) |

The rest are filled in as chunks 3–7 land. Expected groups: auth, exercises, splits (with days and day exercises), workouts (with workout exercises and sets), bodyweight, settings, stats. Record each endpoint's path, method and payload here when it is built.

## Open questions

- Whether `updated_at` used for last-write-wins comes from the client (time of edit) or the server (time of receipt). Client time matches offline edits better but trusts the phone clock; decide in chunk 6.
