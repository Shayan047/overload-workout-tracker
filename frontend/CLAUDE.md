# Frontend (Expo app)

**Status:** not scaffolded yet; roadmap chunk 8 does it.

Read the root `../CLAUDE.md` first. Domain rules there apply here too.

## Stack

- Expo (latest stable SDK) with TypeScript in strict mode.
- Expo Router. Tabs: Today, Splits, Progress, History. Profile opens from the Today header.
- TanStack Query for server data, plus a small persisted outbox for offline writes.
- react-native-svg for charts, hand-built and simple.
- expo-haptics, expo-notifications, @react-native-community/netinfo (Wi-Fi check),
  expo-secure-store (auth tokens).

Ask before adding anything not on this list.

## Planned layout

```
app/                  routes (Expo Router)
src/theme/            built from ../design/tokens.json
src/components/       shared UI pieces
src/features/<name>/  feature screens, hooks and logic
src/api/              API client and outbox
src/lib/              small pure helpers (units, dates, formatting)
```

## UI rules

- Dark only, and colors only from the theme.
- Amber and ice keep their fixed meanings (amber = you/today/main action,
  ice cyan = past self). Never decorative.
- Numbers use condensed Archivo with tabular figures.
- Touch targets are at least 44 px.
- Logging a set and changing an exercise happen in bottom sheets.
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
