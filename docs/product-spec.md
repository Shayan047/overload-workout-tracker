# Product spec

Overload (working name) is a workout tracker for iOS and Android.

## Principles

- Personal use first, possibly public later, so everything is multi-user from day one.
- Dark mode only.
- Logging a workout must work with no connection (see `api-and-sync.md`).
- Color meaning: amber = you, today and the main action. Ice cyan = your past self (ghost, last time, earlier sessions).

## Features

### Splits

- Presets are stored as data in code (`backend/app/services/presets.py`), each with library
  exercises and rest lengths. Picking one copies it into the user's own split.
  - Push, pull, legs (in order): Push, Pull, Legs
  - Arnold split (in order): Chest & Back, Shoulders & Arms, Legs. Shoulders & Arms matches
    screen 05: overhead press 2:30, lateral raise 1:00, bicep curl 1:30, hammer curl 1:30,
    triceps pushdown 1:00, chin-up 2:00.
  - Upper, lower (in order): Upper A, Lower A, Upper B, Lower B (A/B so Today can tell the
    two upper days apart; screen 03 shows them as Upper, Lower, Upper, Lower)
  - Body part split (in order): Chest, Back, Shoulders, Arms, Legs
  - Full body (set weekdays): Full body A (Mon), B (Wed), C (Fri)
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
- Plateau and projection (decided in chunk 7; `backend/app/stats/trend.py`):
  - **Plateau ("Flat for N weeks"):** the best session est. max ever was set at least
    21 days before the latest session, with at least 2 sessions since. N = those days ÷ 7,
    rounded down. Measured to the latest session, not to today, so a lift that simply
    wasn't trained lately isn't called a plateau. A tie doesn't count as a new best.
  - **Projection ("If the trend holds… on pace for about X by D"):** a least-squares line
    through the session est. max values of the 8 weeks up to the latest session, projected
    8 weeks past it, starting from the latest est. max. The weekly gain is never negative
    and at most 1.5% of the latest est. max, because a straight line through a jump to a
    heavier weight promises far too much. Needs 3 sessions spanning at least 2 weeks. The
    sample gives about 27.6 lb on Dec 4 (capped).
  - **Change (screen 13, e.g. "+76%"):** latest est. max vs the first session in the window
    (8 weeks by default). Needs two sessions in the window.
  - **New best:** the latest session's est. max beats every earlier session.
- Other stats rules (chunk 7):
  - Sets with 0 reps are failed attempts: they don't count toward est. max, best set or
    the frontier.
  - Retention needs at least 2 sets at that weight and a first set with reps.
  - Bodyweight exercises: est. max uses the load (bodyweight snapshot + added weight), so
    it "includes bodyweight". One-weight views and the frontier use the added weight, since
    that's what the user picks.
  - Records on Exercise detail: best set = highest est. max (earliest on ties); most reps
    = most reps (heavier, then earliest, on ties); heaviest = heaviest weight and the date
    it was first used.
  - Only finished, non-deleted workouts count.

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
- The account is created at the end of onboarding, after Save split on 04. What the user
  picks before that (unit, bodyweight, split) is saved on the phone and sent as soon as the
  account exists. "I already have an account" on 01 goes to sign-in, then Today.
- Bodyweight must be a plausible adult weight: 45–660 lb or 20–300 kg. Switching the unit on
  02 converts what was typed.
- From Edit split, tapping a day opens Edit a day (05), whose Add exercise button opens Add exercises (06).
- Save split goes to Today (07).

**Splits (chunk 11)**

- Picking a preset or "Build my own" (one empty "Day 1") opens Edit split (04) with a copy.
  Nothing is saved until "Save split", which also makes it the active split.
- Days and exercises reorder by dragging the handle (screen readers: move up/down).
- On Edit a day (05), "…" opens the exercise's rest length (−15/+15 s, 0–60 min) and Remove;
  the pencil renames the day, sets its weekday (set weekdays mode) and removes it.
- Switching to "Set weekdays" spreads days without a weekday over the week (3 days: Mon,
  Wed, Fri). Each day needs its own weekday to save.
- Add exercises (06) searches the library on the phone (same rules as the API), filters by
  muscle group (the design's chips plus Core), marks exercises already in the day, and adds
  the selected ones with a 1:30 rest. "Can't find it?" creates a custom exercise (name,
  main muscle, bodyweight or not).
- The Splits tab shows the active split in Edit split, with "Pick another" instead of a back
  button; with no active split it shows Pick a split.

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
