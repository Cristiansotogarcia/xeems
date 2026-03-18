# XEEMS

## Overview

XEEMS is XA Tech's employee monitoring platform for company-owned devices.

- `apps/web` is the admin control plane
- `apps/desktop` is the managed Windows laptop agent
- `apps/mobile` is the employee shift and GPS app for company-issued phones
- `supabase/schema.sql` is the current database source of truth

This repository no longer targets the original FieldOps consent-first MVP. The active product model is:

- Admin creates every employee account
- Employees sign in to the desktop app once to enroll a company laptop
- The desktop agent persists across restarts and keeps monitoring unless an admin disables the employee or device
- Mobile tracking stays shift-based for field operations, but runs under written company notification on company-owned phones instead of in-app consent capture

## Platform Model

### Web
- Admin-only Next.js dashboard
- Employee provisioning, password reset, activation control
- Desktop device visibility plus remote enable/disable controls
- Active shifts, sites, and geofence events

### Desktop
- Electron-based managed Windows agent
- Real active-window tracking with idle detection
- Persistent Supabase session storage and device enrollment
- Auto-start on login for packaged Windows builds
- No employee-facing stop, pause, or logout path after enrollment

### Mobile
- Expo app for field shifts on company-issued phones
- Shift start/end, GPS permission flow, background location updates
- Notification-based deployment copy instead of in-app consent collection

## Environment

Copy the templates before local development:

- root: `.env.example` -> `.env`
- web: `apps/web/.env.example` -> `apps/web/.env.local`
- mobile: `apps/mobile/.env.example` -> `apps/mobile/.env`
- desktop: `apps/desktop/.env.example` -> `apps/desktop/.env`

Required variables:

- Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Mobile: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Desktop: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## Local Setup

1. Install Node 20+ and pnpm 9+.
2. Run `pnpm install`.
3. Apply `supabase/schema.sql`.
4. Apply `supabase/seed.sql`.
5. Create an initial admin user in Supabase Auth.
6. Promote that user in SQL:

```sql
update public.profiles
set role = 'admin'
where id = '<ADMIN_USER_UUID>';
```

7. Start the workspace with `pnpm dev`.

## Verification

The current workspace has been validated with:

- `pnpm typecheck`
- `pnpm --filter fieldops-web build`
- `pnpm --filter xeems-desktop build`
- `pnpm --filter @fieldops/mobile build`

## Notes

- `consent_records` still exists in the schema for legacy compatibility, but the active XEEMS deployment no longer requires in-app consent capture to start tracking.
- The root `postinstall` script normalizes the web app's React resolution under pnpm so Next.js production builds do not split React contexts during `_error` prerendering.
