# Frontend (Expo app)

**Status:** through roadmap chunk 20 (history, profile and bodyweight). See `../docs/roadmap.md`.

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
- Jest with jest-expo (dev only): `npm test`.
- TanStack Query for reading server data; our own outbox (`src/api/outbox.ts`) for writes.
- @react-native-async-storage/async-storage: the outbox queue and the offline cache.
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
src/features/<name>/  feature screens, hooks and logic (auth/, onboarding/, splits/, today/,
                      workout/, progress/, history/, profile/, dev/)
src/api/              config (API URL), http (fetch), session (token), outbox, network
                      (Wi-Fi rule, status copy), cache (offline queries), settings,
                      AppProviders (wires it all up: useAuth, useSync)
src/lib/              small pure helpers: ids, units (kg ⇄ lb, bodyweight input), dates,
                      exercises (search, labels, rest format)
assets/fonts/         generated Archivo instances + OFL.txt
scripts/              make-fonts.py, screenshot.mjs
review/               screenshots (git-ignored)
```

## Commands

Run from `frontend/`.

```
npm start                     # Expo dev server; scan the QR code with Expo Go
npm run typecheck             # tsc --noEmit
npm test                      # unit tests (Jest + jest-expo)
E2E_API_URL=http://localhost:8000 npx jest outbox.e2e
                              # outbox against a running backend (signs up an e2e-… user)
npx expo-doctor               # dependency and config check
npm run shot -- <route> <NN-name> [height] [--no-build] [--url=<dev server>]
                              # review screenshot, e.g. npm run shot -- index 07-today
```

`npm run shot` exports the web build, opens `<route>?review=1` in headless Chromium at
390 px wide and 2x, waits for fonts, and saves `review/<NN-name>.png` (780 px wide).
`--no-build` reuses the last export; `--url` uses a running `npm run web` instead. Write
routes without a leading slash in Git Bash (`progress`, `index` for the root).

## Talking to the API

- `API_URL` (`src/api/config.ts`): `EXPO_PUBLIC_API_URL` if set, otherwise port 8000 on the
  computer running the Expo dev server, so a phone on the same Wi-Fi reaches
  `docker compose up` with no setup. On Windows, allow inbound port 8000 in the firewall.
- **Writes** go through `useSync().write({ method, path, body })` (or a hook built on it,
  like `useUpdateSettings`), never through `fetch`. Update the query cache first, so the
  screen changes at once. See "Offline" in `../docs/api-and-sync.md`.
- **Reads** use TanStack Query with `useSync().request`. Add `meta: { persist: true }` to
  queries that must work offline (today's split, last-time data, recent stats).
- **IDs:** `newId()` for every new row; `derivedId(namespace, name)` for ids the server
  derives too (preset days: `derivedId(splitId, 'day:0')`). Both in `@/lib/ids`.
- A 401 anywhere sends the user back to sign-in; their unsent writes stay and go out after.
  Signing in as someone else clears the outbox and cache first.

## Testing on the web

`npm run web` serves the app at http://localhost:8081 and talks to the real API (the
backend allows that origin; see "CORS" in `../docs/api-and-sync.md`). Differences from a
phone: the token is kept in localStorage, and "Sync on Wi-Fi only" is ignored because
browsers don't report Wi-Fi. Add `?review=1` for the fixed sample data instead.

## Splits screens

- `features/splits/draft.ts`: the split being edited and pure edits on it (tested).
  `draftStore.ts` holds it in memory for 04, 05 and 06; nothing is written until Save.
- `plan.ts` turns "saved" + "draft" into the minimal outbox writes (tested). `useSaveSplit`
  sends them, updates the cached split and sets `active_split_id`.
- Routes 03–06 live at the root (`pick-split`, `edit-split`, `edit-day/[dayId]`,
  `add-exercises/[dayId]`) so onboarding (signed out) and the app share them. After sign-in
  or sign-up the history is cleared and the app opens on Today.
- `ReorderableList` gives drag-to-reorder with React Native's own touch handling.
- Review routes: `pick-split?mode=onboarding`, `edit-split?mode=onboarding`,
  `edit-day/rv-day-shoulders`, `add-exercises/rv-day-shoulders` (sample data in
  `src/review/sampleData.ts`).

## Today

- `features/today/today.ts` (tested): the next-day rule, the rotation strip, rest days,
  relative dates and "best set last time", all from cached data.
- Data: settings → active split tree, `GET /workouts` (last day done) and
  `GET /workouts/last-sessions` (best sets), all persisted for offline use. Cached data is
  fresh for 30 s; returning to the app refreshes anything stale.

## Progress screens

- `features/progress/`: Progress (13), Exercise detail (14), One weight (15, 16) and the
  frontier (17). Chart geometry and copy are pure and tested (`chart.ts`, `progressText.ts`,
  `oneWeight.ts`, `frontier.ts`), in
  the designs' SVG coordinates, so positions can be checked against the HTML.
- Stats come from the API (`src/api/stats.ts`) as persisted queries, so they open offline.
- One weight is `one-weight?exerciseId=…&weightKg=…[&view=fingerprint]`; the chips and the
  Progress/Fingerprint toggle change the params in place, and "All weights" goes back.
- Review routes: `progress`, `exercise/rv-curl`,
  `one-weight?exerciseId=rv-curl&weightKg=4.536` (add `&view=fingerprint` for 16),
  `frontier?exerciseId=rv-curl`. Quote
  routes with `&` in the shell.

## History, profile and bodyweight

- `features/history/history.ts` and `features/profile/bodyweight.ts` hold the calendar, its
  line, and the bodyweight chart and ranges (tested). Data: `api/history.ts` and
  `api/bodyweight.ts`, both persisted and merged with writes still in the outbox.
- Review routes: `history` (18, height 880), `profile` (19, height 940) and `bodyweight` (20).
  Profile has no "Export workouts" row: CSV export was dropped.

## Layout and safe areas

The designs' top padding includes a 44 px status bar, and the bottom padding a 34 px home
indicator. Use `useFrameInsets()` and add the rest: 07's `padding-top: 52px` is `top + 8`,
02's `padding-bottom: 36px` is `bottom + 2`. Phones get their real safe area, and review
screenshots line up with the designs.

## Text styles

Font settings (family, weight, width), sizes, line heights and letter spacing are written
**only** in `src/theme/index.ts`. Components and screens use named styles:

- `<Text variant=…>` or `type.<name>`: `body`, `small`, `lead` (the 16 px line under a
  title), `note` (14 px), `label`, `h1`, `h2`, `display` (01's 42 px title), `field`,
  `button`, `buttonMedium`, `buttonSecondary`, `chip`, `segment`, `segmentLarge`, `pill`,
  `unitSuffix`, `wordmark`, `tabLabel`.
- Big numbers: `figure(figures.<name>…, NUMBER_TRACKING)` (the `.num` face at line height 1
  with the designs' tracking) and `figureTimes` for the light "×" between weight and reps.

Need something new? Add a named style to the theme; never write a font size, weight or
`font(…)` call in a component or screen. (`grep -rn "fontSize\|font(" src app` outside
`src/theme` should find nothing.)

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
- Review mode is signed in as a sample user, shows "1 waiting for Wi-Fi" like 07, makes no
  API calls, and also opens the sign-in and sign-up screens (`sign-in`, `sign-up` routes).
- The auth screens have no design number; their screenshots are `00-sign-in` and `00-sign-up`.
- Signed-out users land on Welcome (`welcome`); Units is `units`.

## Checking sync by hand

Development builds have a **Sync check** screen (link on the Today placeholder, route
`/dev-sync`). Sign in, turn on airplane mode, tap "Toggle ghost mode": the pill says "Saved on
this phone" and "Waiting to send" is 1. Turn airplane mode off on Wi-Fi: it drops to 0. With
"Sync on Wi-Fi only" on, mobile data shows "1 waiting for Wi-Fi" instead.

## Dependency hold

`expo` is held at 57.0.27 and `expo-router` at 57.0.25 (`expo.install.exclude` in
package.json, so `npx expo install --fix` leaves them alone). Their next patches pull in
`react-native-worklets` 0.13, which conflicts with `expo-modules-core`'s peer range (up to
0.10). npm then nests `expo-modules-core`, and jest-expo, which requires it without declaring
it, can't find it. Lift the hold when `npx expo install expo expo-router` leaves
`node_modules/expo-modules-core` at the top level and `npm test` passes.

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
