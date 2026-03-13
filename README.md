# Workforce GPS Consent MVP

Consent-based workforce location tracking MVP for active-shift attendance, live field visibility, and geofence events.

## What changed in this pass

- Wired both apps to the real Supabase project URL for **GPS Monitoring** (`gfvxqomihlolxhfigebk`)
- Split auth flows more clearly:
  - **mobile app = employees only**
  - **web dashboard = owners/admins only**
- Replaced demo-only auth placeholders with Supabase email/password sign-in
- Added shift start/end RPC usage so tracking scope is enforced by the database
- Expanded the schema with auto-profile bootstrap, one-active-shift protection, and stronger RLS guidance

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
4. Apply `supabase/schema.sql` in the Supabase SQL editor
5. Create at least:
   - one owner/admin user
   - one employee user
   - one active site row
6. Run `pnpm install`
7. Run `pnpm dev`

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
- web owner/admin sign-in via Supabase
- web dashboard loading active shifts, recent geofence events, and sites from Supabase
- database policies closer to real role separation

Still incomplete:
- true background GPS sync implementation and device permission UX
- map visualizations
- seed/bootstrap automation for users and sites
- production route protection/middleware on the web app
- end-to-end validation against a fully configured live Supabase project

See `docs/implementation-plan.md` for the setup checklist.
