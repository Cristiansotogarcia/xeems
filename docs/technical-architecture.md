# Technical Architecture

## Stack choice

Expo React Native for the employee app, Next.js for the owner/admin dashboard, and Supabase for auth + Postgres + RLS.

## Why this stack

- Expo is the fastest route to employee mobile shift UX and device permission handling
- Supabase gives auth, SQL, RLS, and realtime-friendly primitives with low backend overhead
- Next.js is enough for an owner operations dashboard without overbuilding
- Shared TypeScript constants reduce drift across apps

## High-level components

### Mobile app (`apps/mobile`)
- employee sign-in
- employee shift console
- consent capture before shift activation
- location service abstraction (real background sync still pending)

### Web app (`apps/web`)
- owner/admin sign-in
- operations dashboard for active shifts, sites, and recent geofence events

### Shared package (`packages/shared`)
- domain types
- Supabase project constants
- environment helpers

### Supabase backend
- Auth users
- `profiles`, `sites`, `consent_records`, `shifts`, `location_pings`, `geofence_events`
- RLS policies for employee-vs-admin separation
- RPCs for `start_shift` and `end_my_active_shift`
- auth trigger to auto-bootstrap profiles

## Role split

### Employee
- authenticates in mobile app
- can read own profile / shifts / consent / pings
- can only create shift-scoped tracking data for self
- cannot use owner/admin dashboard

### Owner/admin
- authenticates in web app
- can read org operational data
- can manage sites in SQL/RLS model
- cannot use employee mobile shift tracking flow

## Data model notes

### profiles
- mirrors `auth.users`
- role is the app access switch (`worker` or `admin`)

### consent_records
- versioned consent trail
- used as a prerequisite for starting a shift

### shifts
- active shift is the permission boundary for tracking
- partial unique index prevents multiple active shifts per employee

### location_pings
- only insertable when the authenticated user owns the active shift

### geofence_events
- currently generated with nearest-site placeholder logic after ping insert
- good enough for MVP plumbing, not final geofence quality

## Tracking lifecycle

1. employee signs in on mobile
2. employee sees disclosure and starts shift
3. app records consent row
4. app calls `start_shift(...)`
5. only then should GPS collection/sync run
6. employee ends shift
7. app calls `end_my_active_shift()`
8. GPS collection must stop immediately

## Security and compliance stance

- RLS enabled on every operational table
- no covert or off-shift tracking path should exist
- owner/admin view is intentionally separated from employee app
- service role remains for trusted backend tasks only
- live secrets stay in local env files, not committed repo files

## Known MVP gaps

- no production-grade server-side web session enforcement yet
- no actual background Expo task + ping uploader yet
- geofence calculations are intentionally simplistic
- no seed automation or migration tooling yet
