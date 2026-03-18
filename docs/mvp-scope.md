# MVP Scope

## In Scope

- Admin/worker authentication
- Admin employee provisioning from the web app
- Desktop device enrollment and remote device control
- Persistent Windows desktop monitoring on company laptops
- Worker shift start / active shift / shift end flows on mobile
- Location ping ingestion tied to active shifts
- Site geofence model and event generation
- Admin dashboard for employees, devices, shifts, events, and sites
- Environment examples and local setup docs

## Out of Scope

- Covert deployment
- Employee-controlled desktop pause or logout flow after enrollment
- Off-shift mobile GPS collection
- Keystroke logging, camera, or microphone capture
- Payroll and scheduling systems

## Definition Of Done

- Web provisions employees and manages enrolled devices
- Desktop signs in once, enrolls, persists, and resumes monitoring after restart
- Mobile starts and ends shift-based tracking successfully
- Supabase schema and RLS match the managed-device model
- Docs and env templates reflect the current XEEMS deployment
