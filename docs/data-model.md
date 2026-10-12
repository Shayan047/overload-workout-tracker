# Data model

Final as of roadmap chunk 2. The schema lives in `backend/app/models/` and the Alembic
migrations in `backend/alembic/versions/`; change it only with a new migration and update
this file in the same commit.

## Conventions

- Every table has `id UUID` primary key, `created_at`, `updated_at` and `deleted_at` (soft delete).
- IDs are generated on the phone so rows created offline keep their IDs. The server
  generates one only for rows it creates itself (for example a user at sign-up).
- **Every user-owned row has `user_id`, child rows included** (split days, day exercises,
  workout exercises, sets). Every query and every `updated_since` pull is then a plain
  filter on the user, and each such table has a `(user_id, updated_at)` index for pulls.
- Weights are stored in kg as `NUMERIC(7,3)` (up to 9999.999 kg) and converted to the
  user's unit only for display. 10 lb is stored as 4.536 kg and reads back as 10.0 lb.
- Rest durations are never recorded. Only configured `rest_seconds` is stored.
- Est. max and other stats are computed, never stored.
- Fixed value sets (unit, kind, repeat mode, status, source) are `text` columns with
  CHECK constraints, not Postgres enums, so adding a value is a one-line migration.
- Constraint names follow a convention (`pk_`, `fk_`, `uq_`, `ck_`, `ix_` + table and
  column), set in `app/db/base.py`.
- Timestamps are `timestamptz`. `updated_at` is the server's `now()` on insert and on any
  change, and is what last-write-wins and pull cursors use (see `api-and-sync.md`).

## Tables

Every table also has `id`, `created_at`, `updated_at` and `deleted_at`.

| Table | Columns |
|---|---|
| users | email, password_hash, display_name (nullable) |
| user_settings | user_id (unique), unit ('lb' or 'kg', default 'lb'), active_split_id (nullable), ghost_mode (default true), sync_wifi_only (default true), rest_alert_sound (default true) |
| exercises | owner_user_id (null = library exercise), name, primary_muscle, secondary_muscles (text[], default empty), equipment (nullable), kind ('weighted' or 'bodyweight') |
| splits | user_id, name, repeat_mode ('in_order' or 'weekdays') |
| split_days | user_id, split_id, name, position, weekday (0–6, nullable, only used in weekdays mode) |
| split_day_exercises | user_id, split_day_id, exercise_id, position, rest_seconds |
| workouts | user_id, split_day_id (nullable), title, started_at, ended_at (null while in progress), bodyweight_kg |
| workout_exercises | user_id, workout_id, exercise_id, position, status ('planned', 'done' or 'skipped'), source ('split', 'added' or 'swapped'), rest_seconds |
| sets | user_id, workout_exercise_id, set_number, weight_kg, reps, logged_at |
| bodyweight_entries | user_id, weight_kg, measured_on (date) |

## Rules the schema supports

- **Bodyweight exercises:** `sets.weight_kg` holds only the added weight. Load = `workouts.bodyweight_kg` + `sets.weight_kg`.
- **Bodyweight snapshot:** `workouts.bodyweight_kg` is copied at workout start. Later bodyweight entries never touch old workouts.
- **Today-only changes** are rows in `workout_exercises` (`status`, `source`, `position`, `rest_seconds`). They never write to `split_day_exercises`. A swap changes the row's `exercise_id` and sets `source = 'swapped'`; an added exercise is a new row with `source = 'added'`.
- **Workout title** is copied from the split day at start, so renaming a day never renames history.
- **Ghost:** the most recent completed workout (`ended_at` not null) that contains the same exercise. Served by the `(user_id, exercise_id)` index on `workout_exercises`.
- **Active split** is `user_settings.active_split_id`, so switching splits is one row write.
- **Deleting a split or a day** soft-deletes its children in the same request (days, day
  exercises) and clears `active_split_id` if it pointed at the split.

## Decisions (chunk 2)

- **Split presets are data in code, not a table.** Creating a split from a preset (chunk 5)
  copies its days and exercises into the user's own `splits`, `split_days` and
  `split_day_exercises` rows. Presets then need no sync, migration or per-user state.
  Presets refer to library exercises by id; library ids are UUIDv5 of the
  free-exercise-db id (chunk 4), so they are stable across servers.
- **Weekdays: 0 = Monday … 6 = Sunday**, matching Python's `date.weekday()`. JavaScript's
  `Date.getDay()` uses 0 = Sunday, so the app converts with `(getDay() + 6) % 7`.
- **`workout_exercises.rest_seconds` exists.** It is copied from the split day exercise at
  start and chosen for added or swapped exercises, so every exercise in a workout has a rest
  length and later split edits never change a workout in progress.
- **Unique constraints only for invariants that a single row write cannot break in passing:**
  - `users`: email, case-insensitive (unique index on `lower(email)`).
  - `user_settings`: one row per user.
  - `workouts`: one in-progress workout per user (partial unique index on `user_id` where
    `ended_at IS NULL AND deleted_at IS NULL`).
- **Ordering columns are not unique** (`position` on days, day exercises and workout
  exercises; `set_number` on sets). A drag-reorder or a renumber after a delete reaches the
  server as several independent PUTs, so the rows briefly share a position. Readers order by
  `position` (or `set_number`), then `created_at`.
- **Sign and range checks:** positions and rest seconds ≥ 0, `set_number` ≥ 1, reps ≥ 0,
  `sets.weight_kg` ≥ 0 (assisted, negative added weight is out of scope), bodyweights > 0,
  `weekday` 0–6, and `ended_at` ≥ `started_at`.
- **Deletes:** rows are soft-deleted in normal use. Hard-deleting a user cascades to all
  their rows, including custom exercises; library exercises stay. Hard-deleting a split day
  sets `workouts.split_day_id` to null, and hard-deleting the active split clears
  `active_split_id`. References to `exercises` use NO ACTION, so an exercise that is still
  in use cannot be hard-deleted.
- **Bodyweight entries are not unique per day.** The latest entry for a day wins; the phone
  updates the same row (same id) when the user corrects a day's value.

## Next-day rule for "in order" splits

The split day after the one in the user's most recent finished workout for the active split (wrapping to the first day after the last). Implemented in chunk 5; see "Next day" in `api-and-sync.md`.
