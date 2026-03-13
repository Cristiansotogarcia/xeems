# Technical Architecture

## Stack choice
Option B: real mobile app using Expo React Native for worker experience and Next.js for admin dashboard.

## Why this stack
- Expo accelerates iOS/Android delivery and location permissions handling
- Supabase covers auth, Postgres, RLS, and realtime with minimal backend overhead
- Next.js gives a quick admin dashboard shell and future deploy flexibility
- Shared TypeScript package reduces drift across mobile/web/backend

## High-level components
- Mobile app (`apps/mobile`)
  - Worker shift UX
  - Permission + consent UX
  - Background/foreground location service abstraction
- Web app (`apps/web`)
  - Admin dashboard scaffold
  - Event feed and active workers overview
- Shared package (`packages/shared`)
  - Domain types, constants, validation helpers
- Supabase backend
  - Auth users
  - Tables: profiles, sites, shifts, location_pings, geofence_events, consent_records
  - RLS policies
  - Edge function or SQL-trigger path for geofence event processing

## Data model

### profiles
- id (uuid, auth user id)
- full_name
- role (`worker` | `admin`)
- is_active
- created_at

### sites
- id
- name
- latitude
- longitude
- radius_meters
- is_active
- created_at

### consent_records
- id
- user_id
- consent_version
- consented_at
- device_platform
- permission_scope

### shifts
- id
- user_id
- site_id nullable
- status (`scheduled` | `active` | `ended` | `cancelled`)
- started_at
- ended_at
- tracking_mode (`foreground` | `background`)
- started_latitude / started_longitude
- ended_latitude / ended_longitude

### location_pings
- id
- shift_id
- user_id
- latitude
- longitude
- accuracy_meters
- speed_mps nullable
- captured_at
- source (`foreground` | `background` | `manual`)

### geofence_events
- id
- shift_id
- user_id
- site_id
- event_type (`enter` | `exit` | `dwell`)
- event_at
- derived_from_ping_id
- metadata jsonb

## Location tracking architecture
- Tracking only activates when shift status becomes `active`
- Mobile service requests permission just-in-time at shift start
- Client batches location updates at configurable interval
- Each ping includes `shift_id` and timestamp
- Backend rejects pings without an active shift
- Ending a shift tears down tracking task on device

## Geofence event model
- Sites represented by center point + radius
- Event generation path:
  1. New ping arrives
  2. Compare ping to assigned/all allowed sites
  3. Determine inside/outside transition from prior ping
  4. Insert `enter` / `exit`
  5. Optional `dwell` after configurable threshold
- MVP can process in SQL/Edge Function hybrid; scale path can move to queue workers later

## Security and compliance
- RLS on every user-linked table
- Workers can read their own profile, shifts, consent, and pings
- Admins can read org-level operational data
- Service role used only in trusted backend contexts
- No permanent location collection outside active shifts
- Consent copy stored versioned in `consent_records`

## Deployment path
- Mobile via Expo/EAS
- Web via Vercel
- Supabase hosted project

## Known MVP tradeoffs
- Battery optimization not fully tuned yet
- Geofence logic starts simple before advanced map matching
- Dashboard is scaffold-level, not enterprise analytics
