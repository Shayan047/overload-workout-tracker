# Frontend (Expo app)

**Status:** skeleton (roadmap chunk 8): Expo SDK 57, four themed tabs, base components, review tooling.

Read the root `../CLAUDE.md` first. Domain rules there apply here too.

## Stack

- Expo (SDK 57) with TypeScript in strict mode. Config is `app.config.ts`, so native
  colors come from the tokens.
- Expo Router, with its required packages (react-native-screens, react-native-safe-area-context,
  expo-linking, expo-constants, expo-status-bar). Tabs: Today, Splits, Progress, History.
  Profile opens from the Today header.
- expo-font for the bundled Archivo instances.
- react-native-web and react-dom: the web target, used only for review screenshots.
- Playwright (dev only): `npm run shot`.
- TanStack Query for server data, plus a small persisted outbox for offline writes.
- react-native-svg for charts, hand-built and simple.
- expo-haptics, expo-notifications, @react-native-community/netinfo (Wi-Fi check),
  expo-secure-store (auth tokens).

Ask before adding anything not on this list.

## Layout

```
app/                  routes (Expo Router); (tabs)/ holds the four tabs
src/theme/            built from ../design/tokens.json (Metro watches ../design)
src/components/       shared UI: Text, Button, Chip, Card, ListRow, Separator,
                      BottomSheet, SegmentedControl, Switch, Screen, TabBar, icons
src/review/           review mode: ?review=1 flag, fixed clock, sample data
src/features/<name>/  feature screens, hooks and logic
src/api/              API client and outbox
src/lib/              small pure helpers (units, dates, formatting)
assets/fonts/         generated Archivo instances + OFL.txt
scripts/              make-fonts.py, screenshot.mjs
review/               screenshots (git-ignored)
```

## Commands

Run from `frontend/`.

```
npm start                     # Expo dev server; scan the QR code with Expo Go
npm run typecheck             # tsc --noEmit
npx expo-doctor               # dependency and config check
npm run shot -- <route> <NN-name> [height] [--no-build] [--url=<dev server>]
                              # review screenshot, e.g. npm run shot -- index 07-today
```

`npm run shot` exports the web build, opens `<route>?review=1` in headless Chromium at
390 px wide and 2x, waits for fonts, and saves `review/<NN-name>.png` (780 px wide).
`--no-build` reuses the last export; `--url` uses a running `npm run web` instead. Write
routes without a leading slash in Git Bash (`progress`, `index` for the root).

## Fonts

- The designs use Archivo's variable width axis, which React Native can't use. So
  `scripts/make-fonts.py` cuts exact static instances (`Archivo-<width>-<weight>.ttf`) for
  every width/weight pair the designs use, and writes `src/theme/fontFiles.ts`.
- Number faces (width 75% or less) have tabular figures baked in.
- Always style text with `<Text variant=…>` or `font(weight, width)` from `@/theme`. Never
  set `fontWeight` or `fontFamily` by hand. Need a new pair? Add it to `INSTANCES` in the
  script and rerun it (instructions at the top of the script).

## Review mode

- `?review=1` on the web build sets `isReviewMode`: screens use `src/review/sampleData.ts`
  and `now()` returns Friday, October 9, 2026, 6:05 PM. Animations jump to their end.
- Use `now()` from `@/review/reviewMode` instead of `new Date()` anywhere a screen shows
  "today", so review screenshots match the designs.
- The root layout sets `data-review-ready` on `<html>` once fonts are loaded; the
  screenshot script waits for it.

## UI rules

- Dark only, and colors only from the theme.
- Amber and ice keep their fixed meanings (amber = you/today/main action,
  ice cyan = past self). Never decorative.
- Numbers use condensed Archivo with tabular figures.
- Touch targets are at least 44 px.
- Logging a set and changing an exercise happen in bottom sheets (`BottomSheet`).
- Every UI chunk ends with the design review loop in `docs/roadmap.md`
  ("How UI chunks are reviewed").
- No emoji, and sentence-case copy.
- For every screen: open `../design/screens/NN-*.png`, `../design/source/NN-*.html` and
  `../design/tokens.json` first. Translate the HTML to React Native; never copy it in.

## Offline rules

- Every write goes through the outbox, and the UI updates immediately.
- Never block logging on the network.
- The rest timer and workout clock are computed from timestamps, never from a ticking
  interval, so they survive the app being backgrounded.
- Generate UUIDs on the phone for every new row.
- Ghost/last-time comparison and the workout summary are computed on the phone from the
  cached previous session.

Details: `../docs/api-and-sync.md`.
