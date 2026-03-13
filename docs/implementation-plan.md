# Implementation Plan

## Current build status

This repo is now materially closer to a real, testable MVP.

Implemented in this pass:
- real Supabase project URL wired to the `GPS Monitoring` project
- employee mobile sign-in flow via Supabase email/password
- owner/admin web sign-in flow via Supabase email/password
- app-side role gates so employee vs owner/admin paths are separated
- database-side shift lifecycle RPCs (`start_shift`, `end_my_active_shift`)
- stronger schema and RLS setup for consent-first, active-shift-only tracking
- Expo-compatible location task architecture for active-shift tracking with foreground fallback
- client/site address fields plus owner dashboard marker scaffolding
- Aruba-friendly seed data and clearer local run sequence

## Recommended local setup sequence

1. Install Node 20+ and pnpm 9+
2. Copy env templates:
   - `.env.example` → `.env`
   - `apps/mobile/.env.example` → `apps/mobile/.env`
   - `apps/web/.env.example` → `apps/web/.env.local`
3. In Supabase Project Settings → API, copy:
   - anon key
   - service role key
4. Open the SQL editor and run:
   - `supabase/schema.sql`
   - `supabase/seed.sql`
5. In Authentication, create:
   - one employee account
   - one owner/admin account
6. Promote the owner/admin profile row:
   - `update public.profiles set role = 'admin' where id = '<OWNER_USER_UUID>';`
7. Run `pnpm install`
8. Run `pnpm dev`
9. For mobile background testing, build a dev client or EAS preview build. Expo Go is not enough for reliable background location validation.

## What is testable now

### Employee mobile app
- Supabase email/password sign-in
- role gate that rejects owner/admin accounts from the worker flow
- consent record insert before shift start
- site selection before starting a shift
- `start_shift` / `end_my_active_shift` lifecycle against Supabase
- immediate location ping on shift start
- Expo background task registration attempt for active-shift-only tracking
- session resume that re-registers tracking when the app reloads during an active shift

### Owner/admin web dashboard
- owner/admin sign-in
- active shift list
- recent geofence event list
- client/site registry with address metadata
- lightweight coordinate map scaffold showing named markers for sites/clients

### Database/backend
- profile bootstrap trigger from `auth.users`
- one-active-shift-per-user protection
- worker/admin RLS split
- active sites readable by workers for shift selection
- Aruba-oriented sample sites in `supabase/seed.sql`

## Honest MVP limitation notes

### Background location in Expo
This implementation is the most credible Expo-managed MVP path, but there is one important caveat:

- **Reliable background location requires a development build / preview build, not plain Expo Go.**
- iOS and Android can still throttle or restrict updates based on OS power policies.
- This repo now handles that honestly by:
  - requesting foreground + background permission explicitly
  - registering an Expo Task Manager location task only when a shift is active
  - stopping the task when the shift ends
  - sending an immediate ping on shift start
  - falling back to foreground/manual sync messaging if background registration fails

So: this is testable and real for an MVP, but it is **not yet production-hard**.

## Phase breakdown

### Phase 1 — foundations
- monorepo structure
- shared types/constants
- Expo app + Next app bootstrapped
- environment templates added

### Phase 2 — backend
- SQL schema for profiles, sites, consent, shifts, pings, events
- auto-profile trigger from `auth.users`
- RLS split between employees and admins
- active-shift enforcement via RPC + unique index
- site/client address model for real named locations

### Phase 3 — employee mobile app
Done now:
- sign-in screen uses Supabase
- admin accounts rejected from mobile flow
- worker screen loads profile, active shift, consent history, sites
- start shift records consent then calls `start_shift`
- end shift calls `end_my_active_shift`
- Expo permission request flow added
- background task registration + immediate ping sync added
- shift resume logic added

Still to do:
- offline queue/retry when device is disconnected
- more explicit permission education screens before OS prompts
- better battery/OS-state handling diagnostics
- optional heartbeat/foreground refresh button for manual recovery

### Phase 4 — owner/admin dashboard
Done now:
- sign-in screen uses Supabase
- dashboard reads profile, active shifts, geofence events, sites
- non-admin users are redirected out
- site registry expanded with client/address/timezone fields
- lightweight marker-based map scaffold added

Still to do:
- true interactive map provider (Mapbox/Google Maps/Leaflet)
- site management create/edit forms
- worker detail views and live route history
- stronger route protection with middleware/server session checks
- realtime subscriptions for live updates

### Phase 5 — hardening
Still needed:
- better geofence logic than nearest-site placeholder
- retention/deletion controls
- audit logging
- tests for shift transitions and role gating
- production deployment config
- service-role-powered onboarding/bootstrap utilities if you want one-click account setup

## Seed data checklist

Minimum useful seed state:
- 1 admin owner account
- 1 employee account
- 2 Aruba site rows from `seed.sql`
- optional: 1 ended shift for history testing

## Compliance notes

Keep these intact in every iteration:
- show disclosure before requesting GPS permissions
- record consent before enabling active-shift tracking
- never allow off-shift location collection
- stop collection immediately when shift ends
- keep owner/admin access separate from employee mobile UX
