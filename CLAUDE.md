# Overload

Personal workout tracker for iOS and Android. "Overload" is a working name.

**Status:** backend done through roadmap chunk 7; frontend through chunk 17 (progress and exercise detail). Build follows `docs/roadmap.md`.

## Where things live

| Path | What |
|---|---|
| `docs/product-spec.md` | Features, user flow, sample data for stats tests |
| `docs/data-model.md` | Tables, columns, constraints and schema decisions |
| `docs/api-and-sync.md` | Architecture, API conventions, offline sync |
| `docs/roadmap.md` | Numbered build chunks with "Done when" lines |
| `design/README.md` | How to use the designs; screen-to-chunk map |
| `design/screens/` | 20 rendered PNGs (the look) |
| `design/source/` | 20 HTML mockups (the exact spec) |
| `design/tokens.json` | Colors, fonts, radii, spacing |
| `frontend/CLAUDE.md` | Expo app stack, layout, commands and rules |
| `.claude/agents/design-reviewer.md` | The design reviewer used in the UI review loop |
| `backend/CLAUDE.md` | FastAPI stack, layout and rules |

## Product in brief

- Multi-user from day one (personal use first, maybe public later). Dark mode only.
- Splits: presets (PPL, Arnold, Upper/Lower, Body part, Full body) or custom. Repeat
  "in order" (rotation; rest days never shift it) or "set weekdays".
- Each split day is an ordered list of exercises, each with its own rest length.
- Exercise library seeded from free-exercise-db, plus custom exercises.
- Workout: start today's day, log working sets (weight, reps), finish. Resumes after restart.
- Ghost mode shows last time set by set while logging. Today-only swap/skip/move/add.
- Rest timer auto-starts on set save; works with the phone locked.
- Summary, progress (est. max, one-weight views, frontier), history, bodyweight, profile.
- Out of scope: social, AI, muscle heatmap, rest-time stats.

Full detail: `docs/product-spec.md`.

## Architecture in brief

- `frontend/`: Expo (React Native, TypeScript). `backend/`: FastAPI + PostgreSQL.
- PostgreSQL is the source of truth. The app talks only to the API, never to the database.
- Offline first for logging: an outbox queue of unsent writes in on-device key-value
  storage (not a local database), plus a cache of today's split, last-time data and recent stats.
- "Sync on Wi-Fi only" is on by default. UI shows "Saved on this phone" / "Waiting for Wi-Fi".
- UUIDs are generated on the phone. Writes are idempotent `PUT /resource/{id}` upserts.
- Pulls use `updated_since`; soft-deleted rows return with `deleted_at` set.
- Conflicts: last write wins per row by `updated_at`.
- Stats (est. max, frontier, retention, plateau, projection) live in a pure Python module
  in the backend. Ghost comparison and workout summary are computed on the phone.

Full detail: `docs/api-and-sync.md`.

## Never break these

1. Weight is stored in kg (NUMERIC with 3 decimals) and converted to the user's unit only for display.
2. Every set stores weight and reps. For bodyweight exercises, the set stores only the added
   weight; the load is the workout's bodyweight snapshot plus the added weight.
3. Each workout saves the user's bodyweight at that time. Changing bodyweight later never
   changes old workouts.
4. Est. max = weight × (1 + reps ÷ 30) (Epley). A session's est. max comes from its best set.
   It is computed, never stored.
5. Rest durations are never recorded or used in any stat. Only each exercise's configured
   rest length is stored.
6. Changes made during a workout apply to that workout only and never edit the split.
7. One-weight stats (Progress and Fingerprint) only use sets done at that exact weight.
   Retention = reps in the last set ÷ reps in the first set.
8. Frontier: for each weight, keep the most reps ever done. Drop a point if another point
   has at least the same weight and at least the same reps.
9. Ghost = the most recent completed workout that contains the same exercise.
10. Color meaning: amber = you, today and the main action. Ice cyan = your past self (ghost,
    last time, earlier sessions). Never use either color decoratively.

## Workflow

- Build one roadmap chunk per session. Start by restating the chunk's goal and "Done when".
  Stop when it's met, and don't start the next chunk unless asked.
- Before any UI work, open the matching PNG in `design/screens`, its HTML in `design/source`,
  and `design/tokens.json`, and match them. Never hard-code colors or font values outside the theme.
- UI chunks end with the review loop in `docs/roadmap.md` ("How UI chunks are reviewed"):
  screenshot each screen with `npm run shot`, have a fresh design-reviewer compare it
  with the design, fix every blocker and major, and repeat until `VERDICT: PASS`
  (at most 4 rounds). Never review your own screenshot.
- Write unit tests first for domain logic.
- Ask before adding a dependency that isn't listed in `frontend/CLAUDE.md` or `backend/CLAUDE.md`.
- Update `docs/` whenever a decision changes, such as the data model or the API.
- Use conventional commits, with at least one commit per chunk.
