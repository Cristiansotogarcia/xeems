# MVP Scope

## In scope
- Worker/admin authentication
- Role-based routing in mobile + web
- Worker shift start / active shift / shift end flows
- Shift record persistence
- Location ping ingestion tied to active shift id
- Site geofence model
- Backend geofence event generation scaffold
- Admin dashboard scaffold with active shift cards, worker list, event feed, site list
- Worker self-view of tracking state, last sync, and current consent status
- Compliance copy + transparent permission UX
- Environment examples and local setup docs

## Nice-to-have if time permits
- Push notifications for missed check-ins
- Offline queue with durable retry
- Manager notes on shifts
- Multi-tenant org support beyond initial schema assumptions

## Out of scope
- Hidden or covert background tracking
- Facial recognition
- Keystroke or screen monitoring
- Full historical route playback for off-shift periods
- Payroll exports
- Native MDM/device management
- Hardware integrations

## MVP assumptions
- Single organization at first launch
- Admin creates sites manually
- Workers use modern iOS/Android phones
- Map rendering can remain basic in MVP
- Retention policy is short and configurable

## Definition of done
- Repo contains bootstrapped mobile and web apps
- Shared types cover user roles, shifts, locations, geofences, events
- Docs cover product, scope, architecture, implementation
- App code includes auth scaffolding, role-aware navigation, worker/admin UI skeletons
- Supabase schema SQL includes essential tables and policies scaffold
- Environment template and startup commands are documented
