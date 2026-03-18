# Technical Architecture

## Stack

- Expo React Native for the employee mobile app
- Electron + React for the managed Windows desktop agent
- Next.js for the admin dashboard
- Supabase for auth, Postgres, RLS, and RPCs

## High-Level Components

### Mobile app (`apps/mobile`)
- employee sign-in
- shift start / shift end flow
- OS-level location permission requests
- background location updates while a shift is active

### Desktop app (`apps/desktop`)
- employee one-time sign-in
- device enrollment into `desktop_devices`
- active-window tracking and idle detection
- persistent background sync tied to backend device state

### Web app (`apps/web`)
- admin-only sign-in
- employee provisioning
- password reset and employee activation management
- desktop device visibility and remote device disable/enable
- shift, site, and geofence dashboard views

### Supabase backend
- Auth users
- `profiles`, `desktop_devices`, `sites`, `shifts`, `location_pings`, `geofence_events`, `activity_logs`, `idle_events`
- optional legacy `consent_records`
- RLS policies for worker/admin separation
- `start_shift` and `end_my_active_shift` RPCs
- auth trigger that bootstraps `profiles`

## Role Split

### Worker
- signs in to mobile or desktop
- can only write self-owned operational data allowed by RLS
- cannot use the admin dashboard

### Admin
- signs in to web only
- provisions employees
- manages employee active state and desktop device monitoring state
- can read org-wide operational data

## Tracking Lifecycle

### Desktop
1. Admin creates employee account
2. Employee signs in once on a company laptop
3. Desktop app upserts an enrolled `desktop_devices` row
4. Session persists locally and monitoring resumes after restart
5. Admin can disable the employee or device to stop future capture

### Mobile
1. Employee signs in on a company-issued phone
2. Employee starts a shift
3. App requests OS location permissions
4. App calls `start_shift(...)`
5. GPS collection runs only while the shift is active
6. Employee ends the shift
7. App calls `end_my_active_shift()`

## Compliance Stance

- This deployment assumes company-owned devices plus written employee notification
- Desktop monitoring is transparent but not employee-controllable after enrollment
- Mobile tracking remains shift-scoped
- Service-role access is limited to trusted server code in the web app
