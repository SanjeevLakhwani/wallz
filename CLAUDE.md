# Wallz — Claude Instructions

## What this is
Social discovery app. Physical fiducial markers (QR-based) placed in the real world. Users scan to discover, saves are permanent, tags expire 30 days after approval. Map shows geohash area counts — never exact pin locations.

## Repo layout
```
wallz/
├── CONCEPT.md          # Full product concept — read this first
├── mobile/             # All code lives here (Expo 56 + Supabase + Mapbox)
```

All work happens inside `mobile/`. See `mobile/CLAUDE.md` for code-level instructions.

## Key rules
- Never store exact GPS coordinates. Location = geohash precision 5 only (~4.9km cell).
- `discoveries` table has `UNIQUE(user_id, marker_id)` — one discovery per user per tag, DB enforced.
- Tags expire via `expires_at` field set by edge function on approval. Expiry = read-only after set.
- `status` field on markers: `pending` → `approved` only. Never revert.
