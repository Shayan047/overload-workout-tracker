# Frontend (Expo app)

**Status:** plumbing (roadmap chunk 9): API client, sign-in/sign-up, offline outbox and cache, sync status.

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
src/features/<name>/  feature screens, hooks and logic (auth/, dev/ so far)
src/api/              config (API URL), http (fetch), session (token), outbox, network
                      (Wi-Fi rule, status copy), cache (offline queries), settings,
                      AppProviders (wires it all up: useAuth, useSync)
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

## Layout and safe areas

The designs' top padding includes a 44 px status bar, and the bottom padding a 34 px home
indicator. Use `useFrameInsets()` and add the rest: 07's `padding-top: 52px` is `top + 8`,
02's `padding-bottom: 36px` is `bottom + 2`. Phones get their real safe area, and review
screenshots line up with the designs.

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
