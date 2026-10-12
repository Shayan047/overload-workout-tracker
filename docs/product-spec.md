# Product spec

Overload (working name) is a workout tracker for iOS and Android.

## Principles

- Personal use first, possibly public later, so everything is multi-user from day one.
- Dark mode only.
- Logging a workout must work with no connection (see `api-and-sync.md`).
- Color meaning: amber = you, today and the main action. Ice cyan = your past self (ghost, last time, earlier sessions).

## Features

### Splits

- Presets are stored as data:
  - Push/Pull/Legs
  - Arnold split: Chest & Back, Shoulders & Arms, Legs
  - Upper/Lower
  - Body part split: Chest, Back, Shoulders, Arms, Legs
  - Full body (Mon/Wed/Fri)
- Users can also build fully custom splits.
- Two repeat modes:
  - **In order:** a rotation. The next day comes whenever the user trains, and rest days never shift it. Next day = the split day after the one in the user's most recent finished workout for the active split (wrapping around).
  - **Set weekdays:** each day is tied to a weekday.

### Day editor

- An ordered list of exercises.
- Each exercise has its own rest length (for example 1:00 to 2:30).

### Exercise library

- A premade list seeded from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), released under the Unlicense (a public-domain dedication; confirmed 2026-10-11 at commit `f00c92c`). A trimmed copy is vendored in `backend/app/seed/free_exercise_db.json`.
- 739 exercises: the upstream 876 minus the stretching (123) and cardio (14) entries, which can't be logged as weight × reps.
- Search and muscle-group filters.
- Users can create custom exercises, visible only to them.
- Each exercise has a primary muscle, secondary muscles, equipment, and a kind: weighted or bodyweight.
- Import mapping (`backend/app/seed/exercises.py`): the first of `primaryMuscles` is `primary_muscle` and the rest join `secondary_muscles` (deduplicated). `kind` is bodyweight when equipment is `body only`, otherwise weighted. Null equipment stays null. Names are converted to sentence case, keeping proper nouns (Arnold, Smith, Romanian…), abbreviations (EZ) and shape letters (T-bar) capitalized.
- Library ids are UUIDv5 of the upstream id, so they are the same on every server, presets can refer to them, and the seed (`python -m app.seed`, run on every container start) is idempotent: it inserts new exercises, updates changed ones, leaves unchanged ones alone, and soft-deletes ones no longer in the file.

### Workout

- Start from today's split day, log sets (weight and reps), and finish.
- Working sets only. There is no warm-up set type.
- Elapsed time is shown.
- An unfinished workout resumes after an app restart.

### Last time and ghost mode

- While logging, show the same exercise's most recent completed session set by set, and whether the user is ahead or behind.
- Ghost = the most recent completed workout that contains the same exercise.
- Ghost mode can be turned off in settings.

### Today-only changes

- Swap, skip, move to end, or add an exercise.
- These never change the saved split.

### Rest timer

- Starts automatically when a set is saved, using the exercise's rest length.
- Controls: −15, +15 and skip.
- Haptic at 10 seconds left and at the end. Optional sound.
- Works with the phone locked via a local notification.
- Later: a lock-screen Live Activity (iOS) and an ongoing notification (Android).
- Actual rest durations are never recorded or used in stats.

### Summary

Shown after finishing: duration, sets, volume, comparison with last time per exercise, and new bests.

### Progress

- **Progress list:** exercises with est. max sparklines and plateau flags.
- **Exercise detail:** est. max chart over time, with bands showing the weight used and a projection, plus weight filter chips.
- **One-weight view**, with two modes:
  - Progress: stacked bars of reps per set for each session.
  - Fingerprint: reps by set number for each session, plus retention.
- **Rep-weight frontier** chart.

Formulas:

- Est. max = weight × (1 + reps ÷ 30) (Epley). A session's est. max comes from its best set. Computed, never stored.
- Retention = reps in the last set ÷ reps in the first set, at one exact weight.
- Frontier: for each weight, keep the most reps ever done. Drop a point if another point has at least the same weight and at least the same reps.
- Plateau and projection: method decided in chunk 7 and documented here.

### History, bodyweight and profile

- History calendar and a list of recent workouts.
- Bodyweight log.
- Profile settings: units (lb or kg), bodyweight, current split, ghost mode, rest alerts, sync on Wi-Fi only, custom exercises, CSV export.

### Out of scope for now

Social features, AI features, muscle heatmap, rest-time statistics.

## User flow

Screen numbers match `design/screens/`.

**First launch**

- Welcome (01) → Units and bodyweight (02) → Pick a split (03) → Edit split (04).
- From Edit split, tapping a day opens Edit a day (05), whose Add exercise button opens Add exercises (06).
- Save split goes to Today (07).

**Returning users**

- Open on Today (07). Tabs: Today, Splits, Progress, History.
- Profile (19) opens from the avatar on Today, and Bodyweight (20) from Profile.

**Training**

- Today (07) → Start workout → Active workout (08).
- Tapping a set's reps or "Log set" opens the Log a set sheet (09). Saving closes it and starts the rest timer on 08 (and on the lock screen, 12).
- The "..." on any exercise opens Change an exercise (10), whose Swap action opens Add exercises (06) for today only.
- Finish → Workout summary (11) → Done returns to Today, or "See progress" opens Exercise detail (14).

**Progress**

- Progress list (13) → tap an exercise → Exercise detail (14).
- Weight chips (10 lb, 15 lb…) open the one-weight view, which toggles between Progress (15) and Fingerprint (16).
- The frontier card on 14 opens Rep-weight frontier (17).

**History**

- History (18): the calendar and the list of recent workouts.

## Sample data for stats tests

All weights are in lb. The stats module tests (chunk 7) must reproduce these numbers.

Bicep curl at 10 lb:

| Date | Reps per set | Total | Retention |
|---|---|---|---|
| Aug 18 | 12, 8, 7, 7 | 34 | 58% |
| Aug 21 | 12, 9, 9, 8 | 38 | 67% |
| Aug 25 | 12, 10, 9, 9 | 40 | 75% |
| Aug 28 | 13, 11, 10, 10 | 44 | 77% |
| Sep 1 | 14, 12, 11, 11 | 48 | 79% |

Later sessions:

| Date | Weight | Reps per set | Session est. max |
|---|---|---|---|
| Sep 28 | 15 lb | 12, 10, 9, 9 | 21.0 |
| Oct 6 | 20 lb | 6, 5, 5, 4 | 24.0 |
| Oct 9 | 20 lb | 7, 6, 6, 5 | 24.7 |

Expected frontier after Oct 9: 20 × 7, 15 × 12, 10 × 14.

Notes for tests:

- Retention and est. max are shown rounded (whole percent, one decimal). Compare with a tolerance or after rounding.
- Weights are stored in kg, so a test that goes through storage converts lb → kg and back; the pure stats functions can take lb directly.
