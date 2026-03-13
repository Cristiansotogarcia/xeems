# Implementation Plan

## Phase 1 — Foundations
- Create monorepo structure
- Add shared domain types
- Bootstrap mobile and web apps
- Add Supabase client helpers
- Add environment templates

## Phase 2 — Core backend
- Apply SQL schema
- Configure auth and role seeding
- Add RLS policies
- Add geofence event processor stub

## Phase 3 — Worker app
- Sign-in screen
- Consent screen
- Shift dashboard
- Start shift / end shift actions
- Tracking status panel
- Location service abstraction

## Phase 4 — Admin dashboard
- Protected dashboard route
- Summary cards
- Active workers list
- Recent geofence events feed
- Sites list scaffold

## Phase 5 — Hardening
- Error states
- Permission education screens
- Offline retry strategy
- Audit logs and retention settings

## Local setup
1. Install Node 20+ and pnpm 9+
2. Create Supabase project
3. Copy root `.env.example` into app-specific `.env.local` files
4. Set Expo public vars and Next public vars
5. Run `pnpm install`
6. Run `pnpm dev`

## Recommended next build tasks
- Wire actual Supabase auth screens
- Implement Expo background location task registration
- Connect admin dashboard to live queries
- Add seed script for demo admin + sample site
- Add tests for shift state transitions and geofence calculations

## Compliance notes
- Present tracking disclosure before permission request
- Explain what is collected, when, why, and who can see it
- Require explicit shift action to enable tracking
- Stop tracking immediately on shift end
- Add retention setting and deletion workflow before production rollout
