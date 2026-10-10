# Data model

> **Draft: finalized in the schema chunk.** (roadmap chunk 2)

## Conventions

- All tables have `id UUID` primary key, `created_at`, `updated_at` and `deleted_at` (soft delete).
- User-owned tables also have `user_id`.
- IDs are generated on the phone so rows created offline keep their IDs.
- Weights are stored in kg as `NUMERIC(7,3)` and converted to the user's unit only for display.
- Rest durations are never recorded. Only each exercise's configured `rest_seconds` is stored.
- Est. max and other stats are computed, never stored.

## Tables

| Table | Columns |
|---|---|
| users | email, password_hash, unit ('lb' or 'kg') |
| user_settings | user_id, ghost_mode, sync_wifi_only, rest_alert_sound |
| exercises | owner_user_id (null = library exercise), name, primary_muscle, secondary_muscles (text[]), equipment, kind ('weighted' or 'bodyweight') |
| splits | user_id, name, repeat_mode ('in_order' or 'weekdays'), is_active |
| split_days | split_id, name, position, weekday (0–6, only used in weekdays mode) |
| split_day_exercises | split_day_id, exercise_id, position, rest_seconds |
| workouts | user_id, split_day_id (nullable), title, started_at, ended_at (null while in progress), bodyweight_kg |
| workout_exercises | workout_id, exercise_id, position, status ('planned', 'done' or 'skipped'), source ('split', 'added' or 'swapped') |
| sets | workout_exercise_id, set_number, weight_kg, reps, logged_at |
| bodyweight_entries | user_id, weight_kg, measured_on |

## Rules the schema must support

- **Bodyweight exercises:** `sets.weight_kg` holds only the added weight. Load = `workouts.bodyweight_kg` + `sets.weight_kg`.
- **Bodyweight snapshot:** `workouts.bodyweight_kg` is copied at workout start. Later bodyweight changes never touch old workouts.
- **Today-only changes** are rows in `workout_exercises` (`status`, `source`, `position`). They never write to `split_day_exercises`.
- **Ghost:** the most recent completed workout (`ended_at` not null) that contains the same exercise.

## Open decisions for the schema chunk

- Split presets: a table or seed data in code.
- Weekday numbering convention (0 = Monday or 0 = Sunday).
- Whether `workout_exercises` needs a per-workout `rest_seconds` copy, so swapped or added exercises have a rest length.
- Indexes and unique constraints (e.g. one in-progress workout per user, `(workout_exercise_id, set_number)`).

## Next-day rule for "in order" splits

The split day after the one in the user's most recent finished workout for the active split (wrapping to the first day after the last).
