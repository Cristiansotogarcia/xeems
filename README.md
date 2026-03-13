# Workforce GPS Consent MVP

Consent-based workforce location tracking MVP for shift-bound attendance, live field visibility, and geofence events.

## Principles

- Transparent, never covert
- Consent-first onboarding
- Work-context-only tracking
- Data minimization and retention controls
- Clear worker/admin role separation

## Stack

- Monorepo with pnpm + Turborepo
- Mobile: Expo React Native + TypeScript
- Admin web: Next.js 15 + TypeScript
- Backend: Supabase (Auth, Postgres, Realtime, Edge Functions)
- Shared package: types, validation, role constants

## Apps

- `apps/mobile` — worker + lightweight admin mobile interface
- `apps/web` — admin dashboard scaffold
- `packages/shared` — shared contracts and domain models
- `docs` — product and implementation docs

## Quick start

1. Install Node 20+ and pnpm 9+
2. Copy `.env.example` to `.env.local` in relevant apps
3. Run `pnpm install`
4. Run `pnpm dev`

See `docs/implementation-plan.md` for setup details.
