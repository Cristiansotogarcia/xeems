# Product Spec — Consent-Based Workforce GPS Tracking MVP

## Product
FieldOps Consent

## One-line promise
Give field teams a transparent, shift-bound way to verify attendance, share work-status location during active work, and give admins a simple operations view without turning the product into a surveillance tool.

## Problem
Employers with mobile workers need reliable shift verification, site arrival evidence, and limited live visibility during active work. Existing tools often feel invasive, are always-on, or are too operationally heavy for small teams.

## Core users

### Worker
- Starts and ends a shift
- Explicitly consents to location tracking during active shifts
- Sees own status, recent events, and what is being tracked
- Can revoke tracking by ending shift or signing out

### Admin / dispatcher
- Manages workers and sites
- Monitors active shifts and recent location events
- Views geofence arrivals/departures and compliance signals
- Does not access covert background history outside shift scope

## Primary jobs to be done
- Confirm worker clock-in / clock-out with location context
- Show whether a worker is on shift and last known shift-time location
- Detect arrival/departure at assigned geofenced work sites
- Provide a lightweight dashboard for operational awareness

## Non-goals for MVP
- Secret monitoring
- Off-shift tracking
- High-frequency route replay
- Payroll engine
- Advanced workforce scheduling
- Full BI/reporting suite

## Core flows
1. Admin invites worker
2. Worker signs in and reviews consent + tracking policy
3. Worker starts shift and grants foreground/background location permissions
4. Mobile app sends periodic shift-scoped location pings
5. Backend generates geofence enter/exit/dwell events
6. Admin dashboard shows active workers and events
7. Worker ends shift; tracking session stops and UI confirms tracking ended

## Key features
- Email/password or magic-link auth
- Worker/admin role model
- Shift start/stop lifecycle
- Shift-scoped location tracking session
- Site geofences and geofence event log
- Admin dashboard scaffold
- Worker transparency screens
- Consent and compliance notices

## Success metrics
- >= 90% successful shift start flows
- >= 95% location pings associated with an active shift
- >= 90% site arrival events generated within acceptable latency
- < 5 min average admin visibility lag for active workers

## Product principles
- Transparency by default
- Minimal necessary collection
- Explicit user knowledge and control
- Auditability of who tracked what and when
- Easy off switch: end shift stops tracking
