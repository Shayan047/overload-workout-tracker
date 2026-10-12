# Roadmap

Build one chunk per session. Start by restating the chunk's goal and "Done when". Stop when it's met. Commit at least once per chunk with conventional commits.

Before UI chunks, open the listed PNGs in `design/screens/`, their HTML in `design/source/`, and `design/tokens.json`.

## 0. Project base — DONE

- **Goal:** folder structure, CLAUDE.md files, docs, design files and tokens. No app code.
- **Design:** all (extracted into `design/`).
- **Done when:** structure exists and is committed as `chore: project base`.

## Backend

Backend first, since PostgreSQL is the source of truth.

### 1. Backend skeleton — DONE

- **Goal:** FastAPI app, settings, Docker Compose with PostgreSQL, Alembic, pytest, `/health`.
- **Design:** none.
- **Done when:** `docker compose up` works, `/health` returns ok, and one test passes.

### 2. Schema and migrations — DONE

- **Goal:** models and the first Alembic migration from `docs/data-model.md`. Resolve its open decisions and remove the "Draft" mark.
- **Design:** none.
- **Done when:** the migration applies on an empty database and model tests pass.

### 3. Auth — DONE

- **Goal:** email and password sign-up and sign-in, JWT, and a current-user dependency.
- **Design:** none.
- **Done when:** a protected-route test passes.

### 4. Exercise library — DONE

- **Goal:** seed import from free-exercise-db (confirm license), list/search/filter API, and custom exercises.
- **Design:** 06 (for which fields and filters the API must serve).
- **Done when:** the seed loads, search and muscle filter tests pass, and a user can create a custom exercise visible only to them.

### 5. Splits API — DONE

- **Goal:** presets, creating and editing a split, days, day exercises with rest seconds, and next-day logic for both repeat modes.
- **Design:** 03, 04, 05.
- **Done when:** tests cover creating a split from each preset, editing days and exercises, and next-day results for "in order" (rest days don't shift it) and "set weekdays".

### 6. Workouts API — DONE

- **Goal:** start, PUT sets, finish, resume in progress, today-only changes, idempotent upserts, and `updated_since` pulls.
- **Design:** 07, 08, 10.
- **Done when:** tests show replaying the same PUTs twice changes nothing, an in-progress workout is returned on resume, today-only changes leave the split untouched, and `updated_since` returns soft-deleted rows.

### 7. Stats module and endpoints — DONE

- **Goal:** est. max, per-weight sessions, retention, frontier, plateau and projection, as pure functions in `app/stats` plus endpoints.
- **Design:** 13–17 (for which numbers the endpoints must serve).
- **Done when:** tests pass against the sample data in `docs/product-spec.md`.

## Frontend

### 8. Frontend skeleton

- **Goal:** Expo + TypeScript, four tabs (Today, Splits, Progress, History), the theme from `design/tokens.json`, Archivo, and base components.
- **Design:** tokens.json; tab bar from 07.
- **Done when:** the themed tabs run on a phone.

### 9. Plumbing

- **Goal:** API client, auth screens, offline outbox and cache, the Wi-Fi rule, and sync status UI.
- **Design:** none dedicated; follow tokens.json and existing components.
- **Done when:** a write made in airplane mode shows "Saved on this phone", is sent once Wi-Fi returns, and replaying the outbox is harmless.

### 10. Onboarding

- **Goal:** welcome, units and bodyweight.
- **Design:** 01, 02.
- **Done when:** a new user completes onboarding and their unit and bodyweight are saved.

### 11. Splits UI

- **Goal:** pick a split, edit a split, edit a day, add exercises.
- **Design:** 03, 04, 05, 06.
- **Done when:** a user can pick a preset or build a custom split, edit days, exercises and rest lengths, save, and land on Today.

### 12. Today screen

- **Goal:** today's split day, its exercises, and Start workout.
- **Design:** 07.
- **Done when:** Today shows the correct next day for both repeat modes, offline from cache too.

### 13. Active workout, log a set, and ghost

- **Goal:** active workout screen, log-a-set sheet, elapsed time, ghost/last-time comparison, resume after restart.
- **Design:** 08, 09.
- **Done when:** a whole workout can be logged offline, ghost shows last time set by set with ahead/behind, and killing the app resumes the workout.

### 14. Change an exercise for today

- **Goal:** swap, skip, move to end, add.
- **Design:** 10, 06.
- **Done when:** each action works and the saved split is unchanged afterwards.

### 15. Rest timer

- **Goal:** auto-start on set save, −15/+15/skip, haptics at 10 s and at the end, optional sound, local notification when locked.
- **Design:** 08, 09, 12.
- **Done when:** the timer survives backgrounding (timestamp-based) and the notification fires with the phone locked.

### 16. Workout summary

- **Goal:** duration, sets, volume, per-exercise comparison with last time, new bests.
- **Design:** 11.
- **Done when:** the summary is correct offline and "See progress" opens Exercise detail.

### 17. Progress list and exercise detail

- **Goal:** list with est. max sparklines and plateau flags; detail with est. max chart, weight bands, projection, weight chips.
- **Design:** 13, 14.
- **Done when:** both screens render from the stats API and from cache when offline.

### 18. One-weight views

- **Goal:** Progress (stacked reps per set) and Fingerprint (reps by set number, retention).
- **Design:** 15, 16.
- **Done when:** the sample bicep curl data renders with the expected totals and retention.

### 19. Frontier

- **Goal:** rep-weight frontier chart.
- **Design:** 17.
- **Done when:** the sample data shows 20 × 7, 15 × 12, 10 × 14.

### 20. History, profile and bodyweight

- **Goal:** history calendar and recent list, profile settings, bodyweight log.
- **Design:** 18, 19, 20.
- **Done when:** all settings persist and sync, and changing bodyweight does not change old workouts.

### 21. CSV export

- **Goal:** export the user's workouts and sets as CSV from Profile.
- **Design:** 19 (entry point).
- **Done when:** the exported file opens in a spreadsheet with one row per set and weights in the user's unit.

### 22. Lock-screen timer

- **Goal:** iOS Live Activity and Android ongoing notification for the rest timer.
- **Design:** 12.
- **Done when:** the rest countdown is visible on the lock screen on both platforms.

### 23. Release prep

- **Goal:** accessibility pass and store builds.
- **Design:** all.
- **Done when:** screen reader labels and touch targets pass review, and signed iOS and Android builds are produced.
