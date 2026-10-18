# Design

## How to use these files

- The PNGs in `screens/` show how each screen should look. They are rendered at 2x (780 px wide) from a 390 × 844 phone frame; some screens are taller to show their full scroll.
- The HTML files in `source/` have the same names and are the exact spec: sizes, spacing, colors, font settings and copy. They are web mockups, so translate them to React Native components; never copy the HTML into the app.
- When the two disagree, the HTML wins for numbers and the PNG wins for overall look.
- `tokens.json` holds the theme (colors, chart styles, fonts, radii, spacing). `scrim` (the dimmed backdrop behind sheets in 09 and 10) was added in chunk 8. The app's `src/theme` is built from it. Never hard-code a color or font value outside the theme.
- Color meaning is fixed: amber = you, today and the main action; ice cyan (`ghost`) = your past self. Never use either decoratively.

Note: the HTML files reference a `./support.js` that is not included. They are meant to be read as a spec, not necessarily opened in a browser.

## Typography

The mockups use Archivo's variable width axis (`font-stretch` 68% for numbers, 85% for headings, and a few other pairs). React Native can't use that axis, so `frontend/scripts/make-fonts.py` cuts an exact static instance for every width/weight pair the mockups use (numbers at 68%/800 with tabular figures baked in, headings at 85%/700, and so on). Body text uses regular-width Archivo at 15 px / 1.4. See "Fonts" in `frontend/CLAUDE.md`.

## Screens

| File | Screen | Roadmap chunk |
|---|---|---|
| 01-welcome.png | Welcome | 10 |
| 02-units.png | Units and bodyweight | 10 |
| 03-pick-split.png | Pick a split | 11 |
| 04-edit-split.png | Edit split | 11 |
| 05-edit-day.png | Edit a day | 11 |
| 06-add-exercises.png | Add exercises | 11 (reused by 14 for swaps) |
| 07-today.png | Today | 12 |
| 08-active-workout.png | Active workout, with the rest timer | 13, 15 |
| 09-log-set.png | Log a set | 13, 15 |
| 10-change-exercise.png | Change an exercise | 14 |
| 11-workout-summary.png | Workout summary | 16 |
| 12-rest-timer-lock-screen.png | Rest timer on lock screen | 15 (local notification), 22 (Live Activity / ongoing notification) |
| 13-progress.png | Progress | 17 |
| 14-exercise-detail.png | Exercise detail | 17 |
| 15-one-weight-progress.png | One weight: progress | 18 |
| 16-one-weight-fingerprint.png | One weight: fingerprint | 18 |
| 17-frontier.png | Rep-weight frontier | 19 |
| 18-history.png | History | 20 |
| 19-profile.png | Profile (without the "Export workouts" row: CSV export was dropped) | 20 |
| 20-bodyweight.png | Bodyweight | 20 |

Each PNG has a matching `source/NN-name.html`.
