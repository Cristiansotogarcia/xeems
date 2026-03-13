# Workforce GPS Consent MVP

Consent-based workforce location tracking MVP for active-shift attendance, live field visibility, and geofence events.

## What changed in this pass

- Added Expo Task Manager + Expo Location architecture for active-shift-only tracking on the employee app
- Added immediate ping sync plus background registration fallback messaging
- Expanded sites into a client/site location model with address + timezone fields
- Added owner dashboard marker scaffolding for named client locations
- Added Aruba-friendly seed SQL and clearer local testing guidance

## Principles

- Transparent, never covert
- Consent-first onboarding
- Work-context-only tracking
- Data minimization and retention controls
- Clear employee vs owner/admin role separation

## Stack

- Monorepo with pnpm + Turborepo
- Mobile: Expo React Native + TypeScript
- Admin web: Next.js 15 + TypeScript
- Backend: Supabase (Auth, Postgres, Realtime, RPC, Edge Functions later)
- Shared package: types, constants, env helpers

## Apps

- `apps/mobile` — employee app for sign-in, consent, and active-shift tracking
- `apps/web` — owner/admin dashboard
- `packages/shared` — shared contracts, constants, project/env helpers
- `supabase` — schema and SQL bootstrap
- `docs` — product and implementation docs

## Quick start

1. Install Node 20+ and pnpm 9+
2. Copy env files:
   - root: `.env.example` → `.env`
   - web: `apps/web/.env.example` → `apps/web/.env.local`
   - mobile: `apps/mobile/.env.example` → `apps/mobile/.env`
3. In Supabase, copy the **anon key** and **service role key** from Project Settings → API
4. Apply `supabase/schema.sql`
5. Apply `supabase/seed.sql`
6. Create at least:
   - one owner/admin user
   - one employee user
7. Promote the owner/admin account in SQL:
   - `update public.profiles set role = 'admin' where id = '<OWNER_USER_UUID>';`
8. Run `pnpm install`
9. Run `pnpm dev`
10. Use a dev build / preview build for mobile background-location testing. Expo Go is not sufficient for reliable background validation.

## Auth and role model

- Employee accounts use the **mobile app**
- Owner/admin accounts use the **web dashboard**
- Role is stored in `public.profiles.role`
- New profiles are auto-created from `auth.users` via trigger
- Admins can read operational data; employees can only access their own profile/shift/consent/pings

## Supabase project hookup

Project name: `GPS Monitoring`

Project URL:
`https://gfvxqomihlolxhfigebk.supabase.co`

Do **not** commit live anon/service keys. Keep them in local env files only.

## Current MVP state

Working directionally:
- mobile employee sign-in via Supabase
- mobile role gate that rejects owner/admin login on employee app
- consent insert + start/end shift RPC flow
- Expo background task registration attempt for active-shift-only tracking
- immediate location ping sync when shift tracking starts
- web owner/admin sign-in via Supabase
- web dashboard loading active shifts, recent geofence events, and sites from Supabase
- owner dashboard marker scaffold for named client/site locations
- database policies closer to real role separation

Still incomplete:
- production-hard offline retry strategy for location sync
- true map provider integration (current dashboard map is a lightweight coordinate scaffold)
- site CRUD forms and richer owner workflows
- stronger production route protection/middleware on the web app
- end-to-end validation against a fully configured live Supabase project on real devices

See `docs/implementation-plan.md` for the setup checklist and MVP limitations.
