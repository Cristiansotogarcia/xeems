# XEEMS Implementation Plan

## Target State

XEEMS runs as a three-surface product:

- Web admin dashboard for account and device management
- Managed Windows desktop agent for always-on laptop monitoring
- Mobile shift app for company-issued phones

This deployment assumes company ownership of phones and laptops plus written employee notification. In-app consent capture is not the operational gate for tracking.

## Product Rules

- Admin creates and manages employee accounts
- Desktop enrollment happens once per employee device
- Desktop monitoring persists across restart and ordinary window close
- Employees do not get stop, pause, or logout controls in the desktop agent
- Admin can disable an employee or a specific enrolled desktop device remotely
- Mobile tracking remains shift-scoped

## Current Architecture

- `apps/web`: Next.js admin control plane with privileged server routes
- `apps/desktop`: Electron managed agent with real active-window tracking, idle detection, persistent auth, and device enrollment
- `apps/mobile`: Expo shift-tracking client using company-device notice copy
- `packages/shared`: shared types and helper contracts
- `supabase/schema.sql`: tables, RLS, RPCs, and desktop-device policies

## Delivered Changes

### Supabase
- Added `desktop_devices`
- Added `device_id` support to `activity_logs` and `idle_events`
- Added desktop-device RLS for worker self-write and admin full management
- Added employee email persistence in `profiles`
- Removed consent as a prerequisite from `start_shift()`

### Web
- Added admin APIs for employee create, password reset, employee activate/deactivate, and device enable/disable
- Added employee provisioning and desktop-device controls to the dashboard
- Restricted privileged operations to server-side service-role utilities

### Desktop
- Reworked auth/session handling to persist Supabase sessions locally
- Added device enrollment and backend-managed monitoring state
- Replaced placeholder activity capture with `get-windows`
- Removed employee stop-monitoring and logout controls from the supported UI path
- Configured packaged Windows builds to auto-start on login

### Mobile
- Removed in-app consent capture from the shift start path
- Updated permission and status copy for company-owned devices under written notice
- Fixed Expo Router and Metro resolution for the pnpm workspace
- Switched Expo export to `jsc` to avoid the Windows Hermes compiler path issue in this workspace

## Operational Setup

1. Apply `supabase/schema.sql`
2. Apply `supabase/seed.sql`
3. Create an admin in Supabase Auth
4. Promote the admin in `public.profiles`
5. Populate env files from the example templates
6. Run `pnpm install`
7. Run `pnpm dev`

## Validation Commands

- `pnpm typecheck`
- `pnpm --filter fieldops-web build`
- `pnpm --filter xeems-desktop build`
- `pnpm --filter @fieldops/mobile build`
