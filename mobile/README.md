# Wallz — Mobile App

Social discovery app built around physical fiducial markers placed in the real world. Find a tag, scan it, save it forever — but each tag only lives 30 days, and you only get to discover it once.

See [CONCEPT.md](../CONCEPT.md) for full product overview.

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Expo SDK 56, TypeScript |
| Navigation | Expo Router v4 (file-based) |
| Backend | Supabase (auth + postgres + storage + realtime) |
| Map | Mapbox (`@rnmapbox/maps`) |
| State | Zustand |

---

## Project Structure

```
mobile/
├── app/
│   ├── _layout.tsx              # Root layout, auth gate
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Bottom tab bar
│   │   ├── index.tsx            # Map screen
│   │   ├── scan.tsx             # Camera / QR scan
│   │   ├── saved.tsx            # My collection
│   │   └── profile.tsx
│   ├── marker/
│   │   └── [id].tsx             # Marker detail + comments
│   └── submit/
│       └── index.tsx            # 4-step tag submission flow
├── components/                  # Shared UI components
├── lib/
│   ├── supabase.ts              # Supabase client (SecureStore session)
│   ├── geohash.ts               # Precision-5 geohash (~4.9km cells)
│   └── marker.ts                # UUID generation, deep link parsing, expiry
├── stores/
│   ├── authStore.ts             # Zustand: session, user, profile
│   └── markerStore.ts           # Zustand: geohash cell state
├── hooks/
│   ├── useMarkers.ts            # Fetch + sort map cells
│   ├── useDiscovery.ts          # Scan → one-time discovery insert
│   └── useComments.ts           # Realtime Supabase comment subscription
└── supabase/
    ├── migrations/001_init.sql  # Full schema + RLS policies
    └── functions/
        └── approve-marker/      # Edge fn: sets expires_at on approval
```

---

## Setup

### 1. Environment variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...your-public-mapbox-token
RNMAPBOX_MAPS_DOWNLOAD_TOKEN=sk.eyJ1...your-secret-mapbox-token
```

`RNMAPBOX_MAPS_DOWNLOAD_TOKEN` is a Mapbox **secret** token with the `DOWNLOADS:READ` scope — create one at mapbox.com → Account → Access tokens. It is read by `app.config.js` at prebuild time and never committed.

### 2. Supabase: run migration

In the Supabase dashboard → SQL Editor, paste and run:

```
supabase/migrations/001_init.sql
```

This creates all tables, RLS policies, the `marker_stats` view, and the storage bucket.

### 3. Supabase: deploy edge function

```bash
npx supabase functions deploy approve-marker
```

Then create a **Database Webhook** in the Supabase dashboard:
- Table: `markers`
- Event: `UPDATE`
- URL: your edge function URL

This auto-sets `approved_at` and `expires_at = now() + 30 days` when a marker is approved.

### 4. Install dependencies

```bash
npm install --legacy-peer-deps
```

> React 19 peer dep conflicts with some packages — `--legacy-peer-deps` required.

### 5. Install iOS simulator (first time only)

Open Xcode → Settings → Platforms → **+** → download iOS 18.

### 6. Build and run (Mapbox requires native build)

```bash
npx expo prebuild --clean
npx expo run:ios     # or run:android
```

---

## Database Schema

```sql
profiles       -- extends auth.users (id, username, avatar_url)
markers        -- tags (marker_code, area_name, geohash, photo_url, status, expires_at)
discoveries    -- scan events, UNIQUE(user_id, marker_id) enforces one-time rule
likes          -- toggle likes, PRIMARY KEY(user_id, marker_id)
comments       -- threaded comments per marker
marker_stats   -- VIEW: like_count, discovery_count, comment_count per marker
```

**RLS:**
- `markers`: visible if `status = 'approved'` OR `creator_id = auth.uid()`
- `discoveries`: insert only if marker approved + unique constraint blocks duplicates
- `likes` / `comments`: authenticated users only

---

## Key Mechanics

### Location privacy
Geohash precision 5 = ~4.9km × 4.9km cell. Map shows count bubbles per cell — never an exact pin. Users must physically search the area.

### Fiducial marker
UUID v4 encoded as a QR code wrapped in a branded Wallz frame. `wallz://scan/{uuid}` deep link triggers discovery on scan.

### Discovery flow
1. User scans QR
2. App looks up `marker_code` in DB
3. Inserts into `discoveries` — unique constraint blocks duplicates
4. Error states: `already_found`, `expired`, `not_found`, `pending`

### Tag lifecycle
- Creator submits photo + area → `status: 'pending'`
- Admin sets `status: 'approved'` in Supabase dashboard
- Edge function fires → sets `expires_at = now() + 30 days`
- After 30 days: tag no longer discoverable (saves remain permanent)

### Approval (hackathon mode)
No admin UI needed. Set `status = 'approved'` directly in the Supabase table editor. Edge function handles the rest.

---

## Screens

| Screen | Path | Description |
|--------|------|-------------|
| Map | `/(tabs)/` | Mapbox dark map, geohash bubble counts, sort by recent/likes/expiring |
| Scan | `/(tabs)/scan` | Camera QR scanner, handles all discovery states |
| Collection | `/(tabs)/saved` | Permanent saves, expired tags shown greyed out |
| Profile | `/(tabs)/profile` | Username, submit new tag, sign out |
| Marker Detail | `/marker/[id]` | Photo, stats, like toggle, realtime comments |
| Submit | `/submit` | 4-step: generate tag → place + photo → area → submit |

---

## Realtime

Comments use Supabase Realtime `postgres_changes` subscription. Two devices on the same marker detail screen will see comments appear live.

---

## Build Order (Hackathon Priority)

1. ✅ Expo project scaffold + dependencies
2. ✅ DB migrations + RLS
3. ✅ Auth screens
4. ✅ Map screen (geohash bubbles + sort)
5. ✅ Marker detail (likes + comments + realtime)
6. ✅ Scan flow (camera → discovery)
7. ✅ Submit flow (generate tag → upload → pending)
8. ✅ Collection screen
9. ✅ Edge function (approve → set expiry)
