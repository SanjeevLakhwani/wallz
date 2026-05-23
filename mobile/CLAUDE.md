# Wallz Mobile — Claude Instructions

Expo 56 + TypeScript app. Read https://docs.expo.dev/versions/v56.0.0/ before touching Expo APIs — the SDK changed significantly in 56.

## Run
```bash
npm install --legacy-peer-deps   # --legacy-peer-deps required (React 19 peer conflicts)
cp .env.example .env             # fill all 4 keys before running
npx expo prebuild --clean        # required — Mapbox needs native build
npx expo run:ios
```

## Env vars (all required)
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_MAPBOX_TOKEN          # public token (pk.eyJ1...)
RNMAPBOX_MAPS_DOWNLOAD_TOKEN      # secret token (sk.eyJ1...) — picked up by @rnmapbox/maps at prebuild
```

## Stack
- **Expo Router v4** — file-based routing under `app/`
- **Supabase** — auth, postgres, storage, realtime. Client at `lib/supabase.ts`
- **Mapbox** — `@rnmapbox/maps`. Token set via `MapboxGL.setAccessToken()` in `app/(tabs)/index.tsx`
- **Zustand** — `stores/authStore.ts` (session/user/profile), `stores/markerStore.ts` (geohash cells)

## Path alias
`@/` maps to repo root (`mobile/`). Use `@/lib/supabase` not `../../lib/supabase`.

## File structure
```
app/
  _layout.tsx           root layout — auth gate, session listener
  (auth)/               login, register
  (tabs)/               bottom tab screens
    index.tsx           map (main screen)
    scan.tsx            QR camera scanner
    saved.tsx           user's permanent collection
    profile.tsx
  marker/[id].tsx       marker detail + likes + realtime comments
  submit/index.tsx      4-step tag submission

lib/
  supabase.ts           createClient with SecureStore adapter
  geohash.ts            toGeohash / geohashCenter / geohashBounds (precision 5)
  marker.ts             generateMarkerCode / markerDeepLink / parseMarkerDeepLink / daysUntilExpiry

stores/
  authStore.ts          session, user, profile, signOut, fetchProfile
  markerStore.ts        cells (GeohashCell[]), selectedMarkerId

hooks/
  useMarkers.ts         useMapCells() fetches geohash cell counts; getMarkersInCell() for bottom sheet
  useDiscovery.ts       discoverByCode() — handles all states: success/already_found/expired/not_found
  useComments.ts        fetch + realtime subscribe + addComment
```

## Database tables
```
profiles        id, username, avatar_url
markers         id, creator_id, marker_code (UUID), area_name, geohash, photo_url, status, expires_at
discoveries     user_id + marker_id (UNIQUE — one-time discovery enforced at DB level)
likes           (user_id, marker_id) PRIMARY KEY — toggle pattern
comments        id, user_id, marker_id, body
marker_stats    VIEW — like_count, discovery_count, comment_count per marker
```

Migration: `supabase/migrations/001_init.sql` — run in Supabase SQL editor.

## Key invariants — never break these
- **No exact coords**: only store `geohash` (precision 5). Map shows area bubbles, not pins.
- **One discovery per user**: `UNIQUE(user_id, marker_id)` on `discoveries`. Error code `23505` = already found.
- **Expiry is set by edge function**: `supabase/functions/approve-marker/index.ts` sets `expires_at = now() + 30d` on approval. Don't set it manually.
- **status flow**: `pending` → `approved` only. Set via Supabase dashboard, never from client.

## Supabase RLS summary
- `markers`: select if `status = 'approved'` OR `creator_id = auth.uid()`
- `discoveries`: insert only, own rows only
- `likes`: select public, insert/delete own rows
- `comments`: select public, insert own rows

## Adding new screens
Expo Router is file-based. Add a file under `app/` — it becomes a route automatically. Modal screens go under `app/(modals)/` if needed.

## Mapbox notes
- Requires `expo prebuild` — won't work in Expo Go
- `MapboxGL.setAccessToken()` must be called before rendering `MapView`
- Uses `MarkerView` for geohash bubbles (not `PointAnnotation` — deprecated in v10)

## Realtime (comments)
Comments subscribe via `supabase.channel()` with `postgres_changes`. Channel cleaned up on unmount in `useComments.ts`. Don't add more realtime subscriptions without checking channel limits (Supabase free tier: 200 concurrent).
