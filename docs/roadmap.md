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

## How UI chunks are reviewed

Chunks 8–23 build screens. They follow the review loop in CLAUDE.md and use the `design-reviewer` subagent (`.claude/agents/design-reviewer.md`).

For each screen, take a screenshot with `npm run shot -- <route> <NN-name> [height]`. It's saved as `frontend/review/NN-name.png`, at 390 px wide and 2x, with the design's sample data.

Then give a fresh design-reviewer the design PNG, the design HTML, `tokens.json` and the screenshot. Fix every blocker and major item, take a new screenshot, and review again with a new reviewer. Repeat until you get `VERDICT: PASS`, for at most 4 rounds. If the screen still fails after 4 rounds, stop and report the remaining items to the user. Never review your own screenshot.

Every UI chunk's "Done when" also requires:

- every listed screen has `VERDICT: PASS`,
- the navigation matches the "User flow" section of `docs/product-spec.md`,
- the chunk summary lists each screen's verdict, the number of review rounds, and any remaining minor items.

### 8. Frontend skeleton and review tooling — DONE

- **Goal:**
  - Expo with TypeScript, and four tabs: Today, Splits, Progress, History.
  - The theme from `design/tokens.json`, and the Archivo font.
  - Base components: button, chip, card, list row, bottom sheet, segmented control, switch.
  - The review tooling:
    - Expo's web target, used for review screenshots only.
    - `frontend/scripts/screenshot.mjs`, run as `npm run shot`. It uses Playwright, a 390 px viewport, deviceScaleFactor 2, full-page capture, and waits for fonts.
    - A `?review=1` sample-data mode that loads fixed data: the bicep curl sample, Friday Oct 9, and the Arnold split.
    - `frontend/review/` added to `.gitignore`.
    - `.claude/agents/design-reviewer.md`, if it doesn't exist yet.
- **Design:** `tokens.json`, and the tab bar from 07.
- **Review:** screenshot the Today tab shell and compare only the tab bar and background against 07.
- **Done when:** the themed tabs run on a phone, `npm run shot` produces a 780 px wide PNG, and the tab bar gets PASS.

### 9. Plumbing — DONE

- **Goal:** API client, sign-in and sign-up screens, offline outbox and cache, the Wi-Fi rule, and the sync status UI.
- **Design:** none dedicated. Follow `tokens.json` and the style of 01–02.
- **Review:** the reviewer compares sign-in and sign-up with 01–02 for style (colors, type, buttons, fields) instead of an exact layout.
- **Done when:**
  - a write made in airplane mode shows "Saved on this phone", is sent once Wi-Fi returns, and replaying the outbox is harmless,
  - the auth screens get PASS.

### 10. Onboarding — DONE

- **Goal:** welcome, units and bodyweight.
- **Design:** 01, 02.
- **Review:** `01-welcome`, `02-units`.
- **Done when:** a new user completes onboarding, their unit and bodyweight are saved, and both screens get PASS.

### 11. Splits UI — DONE

- **Goal:** pick a split, edit a split, edit a day, add exercises.
- **Design:** 03, 04, 05, 06.
- **Review:** `03-pick-split`, `04-edit-split`, `05-edit-day`, `06-add-exercises`. Screens that don't depend on each other may be reviewed in parallel.
- **Done when:**
  - a user can pick a preset or build a custom split, edit days, exercises and rest lengths, save, and land on Today,
  - all four screens get PASS.

### 12. Today screen — DONE

- **Goal:** today's split day, its exercises, and Start workout.
- **Design:** 07.
- **Review:** `07-today`.
- **Done when:** Today shows the correct next day for both repeat modes, works offline from the cache, and gets PASS.

### 13. Active workout, log a set, and ghost — DONE

- **Goal:** active workout screen, log-a-set sheet, elapsed time, the ghost/last-time comparison, and resume after restart.
- **Design:** 08, 09.
- **Review:**
  - `08-active-workout`, using height 1310, with the rest timer hidden until chunk 15. The reviewer ignores the timer card.
  - `09-log-set`, with the sheet open.
- **Done when:**
  - a whole workout can be logged offline,
  - ghost shows last time set by set, with ahead or behind,
  - killing the app resumes the workout,
  - both screens get PASS.

### 14. Change an exercise for today — DONE

- **Goal:** swap, skip, move to end, and add.
- **Design:** 10, and 06 for swap.
- **Review:** `10-change-exercise`, with the sheet open.
- **Done when:** each action works, the saved split is unchanged afterwards, and 10 gets PASS.

### 15. Rest timer — DONE (the locked-phone notification still needs a check on a phone)

- **Goal:** auto-start when a set is saved, −15/+15/skip, haptics at 10 s and at the end, optional sound, and a local notification when the phone is locked.
- **Design:** 08, 09 and 12.
- **Review:**
  - re-review `08-active-workout`, now including the timer card,
  - re-review `09-log-set`, including the "Saving starts your rest timer" line.
- **Done when:**
  - the timer survives backgrounding, because it's based on timestamps,
  - the notification fires with the phone locked,
  - 08 and 09 get PASS.

### 16. Workout summary — DONE

- **Goal:** duration, sets, volume, per-exercise comparison with last time, and new bests.
- **Design:** 11.
- **Review:** `11-workout-summary`, using height 1050.
- **Done when:** the summary is correct offline, "See progress" opens Exercise detail, and 11 gets PASS.

### 17. Progress list and exercise detail

- **Goal:**
  - the list, with est. max sparklines and plateau flags,
  - exercise detail, with the est. max chart, weight bands, projection and weight chips.
- **Design:** 13, 14.
- **Review:** `13-progress` and `14-exercise-detail` (height 1240). Chart lines, dots, bands and labels must match in position and color.
- **Done when:** both screens render from the stats API and from the cache when offline, and both get PASS.

### 18. One-weight views

- **Goal:** Progress (stacked reps per set) and Fingerprint (reps by set number, plus retention).
- **Design:** 15, 16.
- **Review:** `15-one-weight-progress` and `16-one-weight-fingerprint`, both at height 920.
- **Done when:** the sample bicep curl data renders with the expected totals (34, 38, 40, 44, 48) and retention (58%, 67%, 75%, 77%, 79%), and both screens get PASS.

### 19. Frontier

- **Goal:** the rep-weight frontier chart.
- **Design:** 17.
- **Review:** `17-frontier`.
- **Done when:** the sample data shows 20 × 7, 15 × 12 and 10 × 14, and 17 gets PASS.

### 20. History, profile and bodyweight

- **Goal:** the history calendar and recent list, profile settings, and the bodyweight log.
- **Design:** 18, 19, 20.
- **Review:** `18-history` (height 880), `19-profile` (height 940) and `20-bodyweight`.
- **Done when:**
  - all settings persist and sync,
  - changing bodyweight doesn't change old workouts,
  - all three screens get PASS.

### 21. CSV export

- **Goal:** export the user's workouts and sets as CSV from Profile.
- **Design:** 19, where the export row is the entry point.
- **Review:** re-review `19-profile` only if it changed.
- **Done when:** the exported file opens in a spreadsheet with one row per set, and weights are in the user's unit.

### 22. Lock-screen timer

- **Goal:** an iOS Live Activity and an Android ongoing notification for the rest timer.
- **Design:** 12.
- **Review:** a web screenshot can't capture the lock screen. Take simulator or emulator screenshots instead (`xcrun simctl io booted screenshot` on iOS, `adb exec-out screencap -p` on Android), then have the design-reviewer compare each against `12-rest-timer-lock-screen` for content and colors. The system frame and layout will differ.
- **Done when:** the rest countdown is visible on the lock screen on both platforms, and both screenshots get PASS for content and colors.

### 23. Release prep

- **Goal:** accessibility pass, a final design pass, and store builds.
- **Design:** all.
- **Review:**
  - re-screenshot all 20 screens and run one fresh design-reviewer per screen, in parallel batches,
  - check the full user flow from first launch to the summary.
- **Done when:**
  - every screen gets PASS,
  - screen reader labels and 44 px touch targets pass review,
  - signed iOS and Android builds are produced.
