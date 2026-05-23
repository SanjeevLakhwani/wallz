# Wallz

> Find the tags. Keep them forever.

Social discovery app built around physical fiducial markers placed in the real world. Tags live 30 days. You discover each one once, ever. Your saves last forever.

---

## What is this?

Wallz generates unique QR-based fiducial markers that people print and place on real things in the world — walls, objects, hidden spots. Other users hunt for them using a map that shows only approximate area counts, never exact locations. Find one, scan it, it's yours permanently. Miss it before 30 days, it's gone.

Full concept → [CONCEPT.md](./CONCEPT.md)

---

## Repo Structure

```
wallz/
├── CONCEPT.md        # Full product concept and mechanics
└── mobile/           # React Native app (Expo + Supabase + Mapbox)
```

## Mobile App

**Stack:** Expo 56 · TypeScript · Supabase · Mapbox · Zustand · Expo Router

**Screens:** Map (geohash area bubbles) · Scan (QR discovery) · Collection · Marker Detail · Submit Tag

→ [mobile/README.md](./mobile/README.md) — full setup, schema, and run instructions

---

## Quickstart

```bash
cd mobile
npm install --legacy-peer-deps
cp .env.example .env   # fill in all 4 keys (see mobile/README.md)
npx expo prebuild --clean
npx expo run:ios
```

Run the SQL migration in Supabase dashboard first:
```
mobile/supabase/migrations/001_init.sql
```

---

## Core Mechanics

| Mechanic | How |
|----------|-----|
| No pinpoint location | Map shows geohash cell counts (~5km areas), never exact pins |
| 30-day expiry | Tags expire 30 days after approval — discovery window is finite |
| One-time discovery | `UNIQUE(user_id, marker_id)` — DB enforced, no replays |
| Permanent saves | Expired tags stay in your collection forever |
| Approval gate | Submissions go `pending → approved` via Supabase dashboard |

---

## Built for hackathon

Wallz — 2026
