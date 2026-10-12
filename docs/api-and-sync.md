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

Implemented once in `backend/app/services/sync.py` and used by every synced resource.

- UUIDs are generated on the phone, so rows created offline keep their IDs.
- Writes are idempotent upserts: `PUT /resource/{id}` with the full row (all writable
  fields) returns `200` and the stored row. The server accepts the client's ID and creates
  or updates the row.
- **A replayed PUT changes nothing.** Values equal to what is stored are left alone, so not
  even `updated_at` moves. Replaying the outbox twice is safe.
- **Deleted is final.** Deletes are soft (`DELETE /resource/{id}` sets `deleted_at`,
  `204`). A later PUT to a deleted row is a no-op that returns the tombstone, so a replayed
  create can't bring a row back.
- **DELETE is idempotent:** `204` even for an id the server never saw (created and deleted
  offline) or one already deleted.
- **Ownership:** a PUT to an id that belongs to someone else (or to a library exercise) is
  `404`. References to other rows (split ids, exercise ids…) must exist and belong to the
  user (or be library exercises), else `404`; soft-deleted targets still count, so replays of
  older writes keep working.
- **Retry rule for the outbox:** `2xx` → done; `401` → keep it and ask the user to sign in;
  other `4xx` → the write can never succeed, so drop it and log it; `5xx` or no response →
  retry later, in order.
- **The outbox is sent in order, one request at a time (FIFO)**, and an entry is removed
  only after its response arrives. Last-write-wins below relies on this.
- Weights are sent and returned in kg (numbers). The phone converts for display.

## Pulling changes

- GET list endpoints accept `updated_since` (an ISO 8601 timestamp with a timezone).
- Without `updated_since` they return live rows only (a first full sync). With it they
  return every row whose `updated_at` is later, including soft-deleted rows with
  `deleted_at` set so the app can remove them.
- **Cursor:** use the largest `updated_at` received, minus a 60-second overlap. Writes are
  stamped with the time their transaction started, so a write that commits a moment after a
  pull can carry a slightly earlier stamp. Re-receiving a few rows is harmless (the app
  upserts by id).

## Conflicts

- Last write wins per row, by `updated_at`. **`updated_at` is the server's time of receipt**
  (decided in chunk 4, when the first PUT endpoint landed). With the FIFO outbox, receipt
  order is edit order for one device, it doesn't trust the phone clock, and one column
  serves both last-write-wins and pull cursors. Trade-off: if two devices edit the same row
  offline, the one that syncs last wins.
- One user on mostly one device makes this enough for now.

## Where stats live

- **Backend, pure Python module (`app/stats`), unit tested:** est. max, frontier, retention, plateau and projection. The app caches the results for offline viewing.
- **Phone, from the cached previous session:** the ghost/last-time comparison and the workout summary, so they work offline.

## Auth

- Email and password sign-up and sign-in. Passwords are hashed with Argon2id (pwdlib).
- Both return an HS256 JWT access token (`sub` = user id) valid for 30 days
  (`ACCESS_TOKEN_TTL_DAYS`). It is long-lived because the app can be offline for days.
  There are no refresh tokens yet; when the token expires the app signs in again, and the
  outbox waits until it has.
- Requests send `Authorization: Bearer <token>`. A missing, invalid or expired token, or a
  deleted user, gets `401` with `WWW-Authenticate: Bearer`.
- Emails are trimmed and lowercased; uniqueness ignores case. Sign-in gives the same `401`
  for an unknown email and a wrong password, and takes the same time for both.
- Tokens are stored on the phone in expo-secure-store.
- Every query is scoped to the current user.

## Endpoints

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health` | none | `{"status": "ok"}` (liveness only; does not check the database) |
| POST | `/auth/sign-up` | none | `{email, password (8–256 chars), display_name?}` → `201 {access_token, token_type: "bearer", user}`; `409` if the email is taken. Also creates the user's settings row. |
| POST | `/auth/sign-in` | none | `{email, password}` → `200 {access_token, token_type, user}`; `401` on bad credentials |
| GET | `/me` | bearer | `{id, email, display_name}` |

Every endpoint below needs a bearer token. Synced rows always include `id`, `created_at`,
`updated_at` and `deleted_at`.

### Exercises

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/exercises` | `q?`, `muscle_group?`, `equipment?`, `kind?`, `updated_since?` | The library plus the user's custom exercises, as `[{name, primary_muscle, muscle_group, secondary_muscles, equipment, kind, is_custom}]`. `q` matches every word of the name, ignoring case and hyphens; exact and prefix matches come first, then A–Z. |
| PUT | `/exercises/{id}` | `{name, primary_muscle, secondary_muscles?, equipment?, kind}` | Creates or updates the user's custom exercise. Library exercises are read-only (`404`). |
| DELETE | `/exercises/{id}` | | `204`. Soft-deletes the user's custom exercise. |

Vocabulary (validated on custom exercises, `422` otherwise; defined in
`app/services/exercises.py`):

- **Muscles:** abdominals, abductors, adductors, biceps, calves, chest, forearms, glutes,
  hamstrings, lats, lower back, middle back, neck, quadriceps, shoulders, traps, triceps.
- **Muscle groups** (the filter chips on screen 06; matched on the primary muscle):
  chest; back = lats, middle back, lower back, traps; shoulders; biceps; triceps;
  legs = quadriceps, hamstrings, glutes, calves, adductors, abductors; core = abdominals;
  forearms; neck.
- **Equipment:** barbell, dumbbell, cable, machine, kettlebells, bands, body only,
  e-z curl bar, medicine ball, exercise ball, foam roll, other (or null). The app maps
  these to display labels (e.g. "e-z curl bar" → "EZ bar", "body only" → "Bodyweight").
- **Kind:** weighted, bodyweight.

The rest are filled in as chunks 5–7 land.
