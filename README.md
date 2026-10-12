# Overload

Overload (working name) is a personal workout tracker for iOS and Android. You pick or build a training split, log working sets during a workout with your last session shown alongside as a "ghost", rest between sets with an automatic timer, and track progress through estimated max, per-weight rep trends and a rep-weight frontier. It works offline during workouts and syncs to a FastAPI + PostgreSQL backend.

## Folder map

```
overload/
├── CLAUDE.md          rules and pointers for Claude Code sessions
├── docs/              product spec, data model, API and sync, roadmap
├── design/            screen PNGs, HTML source, tokens.json
├── frontend/          Expo (React Native, TypeScript) app
└── backend/           FastAPI + PostgreSQL API
```

Status: backend done through roadmap chunk 7; frontend through chunk 9 (plumbing). Build follows docs/roadmap.md.

## Designs

The designs live in `design/`: rendered screens in `design/screens/`, their HTML specs in `design/source/`, and design tokens in `design/tokens.json`. See `design/README.md` for how to use them.
