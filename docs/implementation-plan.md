# Implementation Plan

## Current build status

This repo is now past pure scaffold status, but it is still an MVP-in-progress.

Implemented in this pass:
- real Supabase project URL wired to the `GPS Monitoring` project
- employee mobile sign-in flow via Supabase email/password
- owner/admin web sign-in flow via Supabase email/password
- app-side role gates so employee vs owner/admin paths are separated
- database-side shift lifecycle RPCs (`start_shift`, `end_my_active_shift`)
- stronger schema and RLS setup for consent-first, active-shift-only tracking

## Recommended local setup sequence

1. Install Node 20+ and pnpm 9+
2. Copy env templates:
   - `.env.example` → `.env`
   - `apps/mobile/.env.example` → `apps/mobile/.env`
   - `apps/web/.env.example` → `apps/web/.env.local`
3. In Supabase Project Settings → API, copy:
   - anon key
   - service role key
4. Open the SQL editor and run `supabase/schema.sql`
5. In Authentication, create:
   - one employee account
   - one owner/admin account
6. Update the owner/admin profile row:
   - `public.profiles.role = 'admin'`
7. Insert at least one site into `public.sites`
8. Run `pnpm install`
9. Run `pnpm dev`

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

### Phase 3 — employee mobile app
Done now:
- sign-in screen uses Supabase
- admin accounts rejected from mobile flow
- worker screen loads profile, active shift, consent history, sites
- start shift records consent then calls `start_shift`
- end shift calls `end_my_active_shift`

Still to do:
- real Expo permission request UX
- background task registration and location ping syncing
- site assignment UX
- better session restoration/loading states

### Phase 4 — owner/admin dashboard
Done now:
- sign-in screen uses Supabase
- dashboard reads profile, active shifts, geofence events, sites
- non-admin users are redirected out

Still to do:
- stronger route protection with middleware/server session checks
- site management forms
- worker detail views
- live map/realtime updates

### Phase 5 — hardening
Still needed:
- offline retry strategy for mobile sync
- retention/deletion controls
- audit logging
- tests for shift transitions and role gating
- production deployment config

## Seed data checklist

Minimum useful seed state:
- 1 admin owner account
- 1 employee account
- 1 site row with radius
- optional: 1 ended shift for history testing

## Compliance notes

Keep these intact in every iteration:
- show disclosure before requesting GPS permissions
- record consent before enabling active-shift tracking
- never allow off-shift location collection
- stop collection immediately when shift ends
- keep owner/admin access separate from employee mobile UX
