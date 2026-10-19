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

How it's built (chunk 9, `frontend/src/api/`):

- **Outbox** (`outbox.ts`): a JSON array in AsyncStorage (`overload.outbox.v1`). `add()`
  resolves once the entry is stored. One run at a time sends the oldest entry and waits for
  its answer. It applies the retry rule below: 408, 429, 5xx and no answer back off 2 s, 5 s,
  15 s, 30 s, 1 min, 2 min, then every 5 min.
- **What starts a run:** a NetInfo network change (airplane mode off, Wi-Fi back), the app
  returning to the foreground, a new write, or the retry timer. Runs happen only while the
  app is open; anything queued while it's closed goes on the next open.
- **The Wi-Fi rule** (`network.ts`): with "Sync on Wi-Fi only" on, only Wi-Fi or ethernet
  sends. No connection, or a network that reports no internet, counts as offline.
  Reachability not checked yet counts as reachable (a failed send just retries). The rule
  limits the outbox only; reads may use mobile data.
- **Status copy** (the pill on Today, 07): nothing waiting → hidden; on mobile data with
  Wi-Fi only → "N waiting for Wi-Fi"; signed out → "Sign in to sync"; otherwise (offline,
  sending, retrying) → "Saved on this phone".
- **Before the account exists** (onboarding, chunk 10): writes are queued as usual, but
  nothing is sent while there is no token; the outbox waits as if signed out and sign-up
  resumes it. "Get started" clears any previous user's data on the phone first.
- **Local changes win until sent:** a read whose answer would overwrite a change still in
  the outbox keeps the local value (`outbox.hasPending(path)`; settings so far).
- **Cache** (`cache.ts`): TanStack Query results marked `meta: { persist: true }` are saved
  in AsyncStorage (`overload.cache.v1`) and restored before the first screen renders.
- **Tests:** `outbox.test.ts` covers the rules with a fake network and server.
  `outbox.e2e.test.ts` runs the real outbox against the API: a whole session written
  offline is saved and not sent, goes out once on Wi-Fi, and two full replays leave the
  data unchanged.

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
- Tokens are stored on the phone in expo-secure-store (the web build, used only for review
  screenshots, keeps it in localStorage). The app opens signed in from the phone, with no
  network check, so it works offline.
- A 401 from the API sends the app back to sign-in. Unsent writes stay and go out once the
  same user signs in again. If a different user signs in on the phone, the outbox and cache
  are cleared first, so nobody's writes reach someone else's account. Signing out clears
  them too.
- Every query is scoped to the current user.

## Deployment

The API runs on Render's free plan (Singapore) from `render.yaml`, with Neon free Postgres
(Singapore). It sleeps after 15 minutes idle and takes about a minute to wake; no keep-alive
ping is used, since the app is offline first. Details: "Deploying" in `backend/CLAUDE.md`.

## CORS

Phones don't need CORS. The browser does, for the Expo web dev server (`npm run web`), so
the API allows the origins in `CORS_ORIGINS` (comma-separated; default
`http://localhost:8081,http://127.0.0.1:8081`). Methods GET, POST, PUT and DELETE, headers
`Authorization` and `Content-Type`, and no credentials, since tokens never travel in cookies.
Set `CORS_ORIGINS=""` in production unless a web client is deployed.

## Endpoints

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health` | none | `{"status": "ok"}` (liveness only; does not check the database) |
| POST | `/auth/sign-up` | none | `{email, password (8–256 chars), display_name?}` → `201 {access_token, token_type: "bearer", user}`; `409` if the email is taken. Also creates the user's settings row. |
| POST | `/auth/sign-in` | none | `{email, password}` → `200 {access_token, token_type, user}`; `401` on bad credentials |
| GET | `/me` | bearer | `{id, email, display_name}` |

Every endpoint below needs a bearer token, except the public `GET /exercises` and `GET /presets`. Synced rows always include `id`, `created_at`,
`updated_at` and `deleted_at`.

### Exercises

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/exercises` | `q?`, `muscle_group?`, `equipment?`, `kind?`, `updated_since?` | **Public** (onboarding picks a split before the account exists): without a token, the library only; with one, the library plus the user's custom exercises (a token that is sent but invalid is still `401`), as `[{name, primary_muscle, muscle_group, secondary_muscles, equipment, kind, is_custom}]`. `q` matches every word of the name, ignoring case and hyphens; exact and prefix matches come first, then A–Z. |
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

### Splits

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/presets` | | **Public.** `[{key, name, summary, repeat_mode, days: [{name, weekday, exercises: [{exercise_id, rest_seconds}]}]}]` |
| POST | `/splits/{id}/from-preset` | `{preset}` | Creates the split at `id` from a preset and returns it like `GET /splits/{id}`. Idempotent: if the split exists, nothing changes. Day ids are `uuid5(split_id, "day:{i}")` and day exercise ids `uuid5(split_id, "day:{i}:exercise:{j}")` (0-based), so the phone can create a split from a preset offline and keep editing it before it syncs. |
| GET | `/splits` | `updated_since?` | `[{name, repeat_mode}]` |
| GET | `/splits/{id}` | | The split with its live days in order, each with its live exercises in order: `{name, repeat_mode, days: [{name, position, weekday, exercises: [{exercise_id, position, rest_seconds}]}]}`. `404` if deleted. |
| PUT | `/splits/{id}` | `{name, repeat_mode}` | The split. `repeat_mode` is `in_order` or `weekdays`. |
| DELETE | `/splits/{id}` | | `204`. Also soft-deletes its days and their exercises, and clears it as the active split. |
| GET | `/splits/{id}/next-day` | `on` (the phone's local date, `YYYY-MM-DD`) | `{split_id, day}`; `day` is null on a rest day or when the split has no days. See "Next day" below. |
| GET | `/split-days` | `updated_since?` | `[{split_id, name, position, weekday}]` |
| PUT | `/split-days/{id}` | `{split_id, name, position, weekday?}` | The day. `weekday` is 0 (Monday) to 6 (Sunday) and only used in weekdays mode. |
| DELETE | `/split-days/{id}` | | `204`. Also soft-deletes the day's exercises. |
| GET | `/split-day-exercises` | `updated_since?` | `[{split_day_id, exercise_id, position, rest_seconds}]` |
| PUT | `/split-day-exercises/{id}` | `{split_day_id, exercise_id, position, rest_seconds}` | The row. `rest_seconds` is 0–3600. The exercise must be a library exercise or the user's own. |
| DELETE | `/split-day-exercises/{id}` | | `204` |

Reordering is a PUT per moved row with its new `position`. Positions don't have to be
unique or contiguous; lists sort by `position`, then `created_at`.

**Next day** (`app/services/splits.py`, `next_day`):

- **In order:** the live day after the day of the most recent finished, non-deleted workout
  for this split (by `ended_at`), wrapping to the first day. No such workout: the first
  day. The date doesn't matter, so rest days never shift the rotation. If that last day
  has since been deleted, the rotation continues from where it was.
- **Set weekdays:** the live day whose `weekday` is `on`'s weekday; none means a rest day.
  History doesn't matter.
- In-progress workouts don't count; Today offers to resume them instead.

### Settings

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/settings` | | `{unit, active_split_id, ghost_mode, sync_wifi_only, rest_alert_sound, updated_at}` |
| PUT | `/settings` | `{unit, active_split_id, ghost_mode, sync_wifi_only, rest_alert_sound}` | The settings. `unit` is `lb` or `kg`; `active_split_id` must be the user's split (or null). |

### Workouts

| Method | Path | Body / query | Response |
|---|---|---|---|
| PUT | `/workouts/{id}` | `{split_day_id?, title, started_at, ended_at?, bodyweight_kg?}` | Start (no `ended_at`), edit, or finish (with `ended_at`). `409 {detail: {message, in_progress_workout_id}}` if another workout is in progress; `422` if `ended_at` is before `started_at`, or if `bodyweight_kg` is omitted on create and the user has no bodyweight entry. |
| GET | `/workouts` | `updated_since?` | `[{split_day_id, title, started_at, ended_at, bodyweight_kg}]` |
| GET | `/workouts/history` | | History (18): finished, live workouts, newest first, as `GET /workouts` plus `{sets, ahead, compared}`. `ahead` counts exercises whose total reps beat their previous session (the summary's rule, 11), out of `compared` that had one. Computed by `app/stats/history.py`. |
| GET | `/workouts/in-progress` | | The unfinished workout to resume, with its exercises and sets (as `GET /workouts/{id}`), or `null`. |
| GET | `/workouts/{id}` | | The workout with its live exercises in order, each with its live sets in order: `{…, exercises: [{…, sets: [...]}]}`. `404` if deleted. |
| DELETE | `/workouts/{id}` | | `204`. Also soft-deletes its exercises and their sets. |
| GET | `/workouts/last-sessions` | `exercise_id` (repeat, up to 100) | Last time (ghost) per exercise: `[{exercise_id, workout_id, title, started_at, ended_at, bodyweight_kg, sets: [{set_number, weight_kg, reps}], best_est_max_kg}]`. Exercises never done are left out. `best_est_max_kg` is the best session est. max in any finished workout so far (bodyweight exercises count the snapshot plus the added weight), so the workout summary can flag new bests offline. |
| PUT | `/workout-exercises/{id}` | `{workout_id, exercise_id, position, status?, source?, rest_seconds}` | `status` is `planned` (default), `done` or `skipped`; `source` is `split` (default), `added` or `swapped`. |
| GET | `/workout-exercises` | `updated_since?` | `[{workout_id, exercise_id, position, status, source, rest_seconds}]` |
| DELETE | `/workout-exercises/{id}` | | `204`. Also soft-deletes its sets. |
| PUT | `/sets/{id}` | `{workout_exercise_id, set_number (1–100), weight_kg, reps (0–1000), logged_at}` | The set. For bodyweight exercises `weight_kg` is the added weight only. |
| GET | `/sets` | `updated_since?` | `[{workout_exercise_id, set_number, weight_kg, reps, logged_at}]` |
| DELETE | `/sets/{id}` | | `204` |
| PUT | `/bodyweight-entries/{id}` | `{weight_kg, measured_on}` | The entry. Never changes past workouts. |
| GET | `/bodyweight-entries` | `updated_since?` | `[{weight_kg, measured_on}]` |
| DELETE | `/bodyweight-entries/{id}` | | `204` |

How the phone drives a workout (all through the outbox):

1. **Start:** `PUT /workouts/{id}` with `split_day_id`, `title` (the day's name) and
   `started_at`, then one `PUT /workout-exercises/{id}` per split day exercise, copying
   `exercise_id`, `position` and `rest_seconds`. The phone creates these rows itself so the
   whole workout can be logged offline.
2. **Log:** `PUT /sets/{id}` per set; mark the exercise `done` with a PUT to its row.
3. **Today-only changes** are PUTs to `/workout-exercises/{id}`, never to the split:
   swap = same row with a new `exercise_id` and `source: "swapped"`; skip =
   `status: "skipped"`; move to end = a larger `position`; add = a new row with
   `source: "added"` and its own `rest_seconds`.
4. **Finish:** `PUT /workouts/{id}` again with `ended_at`.
5. **Resume:** after a restart, `GET /workouts/in-progress` (or the phone's own cache).

How the app does it (chunk 13, `frontend/src/features/workout/`):

- **The workout in progress lives on the phone** (`workoutStore.ts`): the workout, its rows,
  its sets, extra "Add set" rows and the exercise in focus, saved in AsyncStorage
  (`overload.workout.active.v1`) on every change and loaded before the first screen. The
  logic is pure (`workout.ts`): each change returns the new state and its writes; the
  state is saved first, then the writes go to the outbox. Killing the app loses nothing:
  on the next launch Today opens the workout again, and shows "Resume workout" while one is
  in progress. The phone's copy is used; `GET /workouts/in-progress` isn't needed yet.
- **Bodyweight snapshot:** the latest bodyweight entry cached on the phone, else the last
  workout's snapshot, else omitted so the server copies its latest entry.
- **Set rows:** as many as last time (3 with no last time), plus "Add set" rows. Logging the
  last planned row marks the exercise `done` and the next planned one comes up. Tapping a
  later exercise moves to it (the one left counts as done if it has sets); tapping a done
  one reopens it. Editing a set rewrites the same id; deleting renumbers the sets after it.
- **Log a set** (09): the weight starts at the previous set today, else last time's set with
  the same number; the keypad's first key replaces it. Steppers move 2.5 lb or 1 kg.
- **Ghost** (`ghost.ts`, computed on the phone from the cached last session): your reps
  through the sets logged so far against last time's reps through the same sets. Hidden,
  with the last-time column and row, when ghost mode is off.
- **Finish:** the `ended_at` PUT goes to the outbox, and the cached history and last-time
  data are updated on the phone, so Today moves on and the next ghost is right offline.
  Finishing with no sets logged offers to discard the workout (`DELETE /workouts/{id}`).
  Until chunk 16's summary, finishing returns to Today.
- **Today-only changes** (chunk 14, 10): every "…" opens Change exercise. Swap and Add use
  the 06 picker (`ExercisePicker`, route `/pick-exercise`). Swap picks one exercise and
  starts on the same muscle group's filter ("pick a similar one"). Add picks several,
  which go to the end with the default 1:30 rest. Move to the end gives the row the next
  position. Skip sets `skipped`; skipped exercises are listed under "Skipped today" with
  Undo. Once a set is logged, Swap and Skip give way to "Done for today" (marks it `done`
  with the sets so far). Each is one PUT to the workout's row; the split is never written.
- **Rest timer** (chunk 15, `rest.ts`, `RestTimerCard.tsx`, `RestAlerts.tsx`): saving a new
  set (not an edit) starts it with that row's `rest_seconds`. It's stored with the workout in
  progress as `{rowId, endsAt, totalSeconds}`, so it counts from timestamps and survives
  backgrounding and the app being killed. −15/+15 move the end and the total; −15 with 15 s
  or less left ends it. It never reaches the API (rule 5). While the app is open, a haptic at
  10 s left and at the end. For a locked phone, a local notification is scheduled for the end
  (fixed identifier, so it's replaced on ±15 and cancelled on skip, finish or sign-out),
  with sound when `rest_alert_sound` is on. In the foreground it shows no banner and only
  plays its sound, so no audio library is needed. Android has two channels (with and without
  sound), since a channel's sound can't change. Permission is asked at the first rest.
- **Summary** (chunk 16, `summary.ts`, 11): worked out on the phone when the workout
  finishes, against last time as it was cached before it: minutes, sets, volume (weight ×
  reps; bodyweight exercises count the snapshot plus the added weight), total reps per
  exercise against last time, "Ahead on N of M", and new bests. A new best is a session
  est. max above `best_est_max_kg` (the best so far, not just last time); a first time
  ever is not a new best. The cached last-time data then takes today's sessions with the
  raised best. The summary is kept in memory; "See … progress" opens Exercise detail for
  the biggest new best (else the biggest gain).
- **Last time for a new set of exercises** (a swap, an add, another day) starts from what
  the other cached last-time queries know, so it shows offline too.
- **Reads keep unsent workouts** (`api/pendingWrites.ts`): refreshing `GET /workouts` applies
  workout PUTs and DELETEs still in the outbox, and last-time data keeps a session finished
  on the phone while its writes are unsent (per exercise, the later `ended_at` wins).
- **History, profile and bodyweight** (chunk 20, `features/history/`, `features/profile/`):
  - `GET /workouts/history` and `GET /bodyweight-entries` are persisted queries. Finishing a
    workout adds its recap (sets, ahead, compared, from the summary) to the cached history,
    and it stays there until the server has the workout; entries logged on the phone stay
    until sent (the local value wins meanwhile). Deletes still in the outbox hide rows.
  - A workout is "Waiting for Wi-Fi" (or "Saved on this phone") while a `/workouts/{id}`
    write is in the outbox; the finish is its last write and the outbox is FIFO, so after
    that the whole workout has been sent ("Synced"). Profile counts those workouts.
  - The calendar marks days with a finished workout; tapping a day lists that day's
    workouts instead of the four most recent. The line under it counts this month's
    workouts and its rest days before today, counted from the first workout ever.
  - Profile writes every setting through `PUT /settings` (the outbox). Bodyweight logs one
    entry per day: logging again the same day rewrites that day's entry (same id). Workouts
    keep their own snapshot (rule 3), so neither changes old workouts.
  - Bodyweight's chart spaces entries evenly (as 20 draws them), with 1 lb (0.5 kg) of room
    above and below before choosing gridlines. Ranges: 1 month, 3 months (default), 1 year,
    all.

Rules:

- **Bodyweight snapshot (rule 3):** if `bodyweight_kg` is omitted when a workout is created,
  the server copies the latest live bodyweight entry (by `measured_on`, then `updated_at`).
  On later PUTs an omitted value keeps the stored one. New entries never touch old workouts.
- **A finished workout stays finished:** a PUT without `ended_at` keeps the stored one, so a
  replayed start can't reopen it.
- **One workout in progress** per user (`409` otherwise).
- **Ghost (rule 9):** the most recent finished, non-deleted workout (by `ended_at`) in which
  the exercise has at least one live set, so a planned-then-skipped exercise isn't a ghost.
  In-progress workouts never count. If the exercise appears twice in that workout, its
  sets are listed in row order.

### Stats

Computed on request by the pure functions in `app/stats` (never stored). Weights and est.
max are in kg (est. max rounded to the gram); the phone converts and rounds for display.
The app caches responses for offline viewing.

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/stats/progress` | `weeks?` (default 8), `as_of?` (default now) | Progress list (13), most recently trained first: `[{exercise_id, includes_bodyweight, sessions, latest_at, est_max_kg, change, is_new_best, plateau: {weeks_flat, best_kg, best_at} \| null, sparkline: [{at, est_max_kg}]}]`. `change` is a fraction (0.76 = +76%). |
| GET | `/stats/exercises/{id}` | | Exercise detail (14): `{includes_bodyweight, est_max_kg, latest_at, first: {at, est_max_kg}, is_new_best, series: [{workout_id, at, est_max_kg, best_set, sets: [{weight_kg, reps}]}], weights: [{weight_kg, sessions, first_at}], best_set, most_reps, heaviest: {weight_kg, first_at}, plateau, projection: {at, est_max_kg, weekly_gain_kg, capped}, frontier}`. Empty values for an exercise never done; `404` for an exercise the user can't see. |
| GET | `/stats/exercises/{id}/weights/{weight_kg}` | | One-weight views (15, 16): `{weight_kg, sessions: [{workout_id, at, reps: [...], total, average, retention}], total_change, first_retention, latest_retention, moved_up_on}`. The weight is rounded to the gram before matching, like stored weights, so 10 lb can be sent as 4.5359237. |
| GET | `/stats/exercises/{id}/frontier` | `as_of?` | Frontier (17): `{as_of, points: [{weight_kg, reps, at}]}`, lightest first. `as_of` gives the frontier as it stood then ("compare with"). |

How the app shows them (chunk 17, `frontend/src/features/progress/`):

- **Cache:** `GET /stats/progress?weeks=8` and `GET /stats/exercises/{id}` are cached on the
  phone (persisted queries), so Progress and Exercise detail open offline with the last
  answer. A workout finished offline shows up there once it has synced and the stats are
  fetched again; until then its numbers are on the summary (11).
- **Progress (13):** today's new bests first, then plateaus, then the rest in the API's
  order (most recently trained first). Values have one decimal under 100 and none above.
  The chips filter by the active split's days. Sparklines run from the window's first
  session to its last, with the lowest est. max at the bottom.
- **Exercise detail (14):** the chart's x axis runs from the first session to the
  projection date (or the last session), y has gridlines at a "nice" step (at most four
  intervals). Weight bands follow the best set's weight; a band changes halfway between the
  last session at one weight and the first at the next. The weight chips open the
  one-weight views and the frontier card opens the frontier.
- **One weight (15, 16; chunk 18):** `GET /stats/exercises/{id}/weights/{weight_kg}`, cached
  like 14. Progress stacks the latest six sessions' reps per set (set 1 at the bottom, sets
  past the fourth share the darkest shade) on a "nice" step with at most five intervals;
  Fingerprint draws the latest session in amber and up to four earlier ones in ice, fading
  with age, with the gain between the oldest and the latest filled. Tables list every
  session, newest first. "You moved up to 15 lb" takes the heaviest weight above this one in
  the session at `moved_up_on`, from the cached exercise detail. Headline copy and geometry
  live in `oneWeight.ts` (tested).
- **Frontier (17; chunk 19):** today's frontier is the `frontier` field of
  `GET /stats/exercises/{id}` (already cached); "Compare with" fetches
  `GET /stats/exercises/{id}/frontier?as_of=<session time>`, also cached. The two dates are
  the session nearest the middle of the history (the later on a tie, as 14's middle label)
  and the first session. The next targets are worked out on the phone: one rep past the best
  at the heaviest weight, and a first set one step heavier (the gap between the two heaviest
  weights; 5 lb or 2.5 kg with only one), with the reps the best est. max predicts by Epley,
  at least 3. `frontier.ts` (tested).
