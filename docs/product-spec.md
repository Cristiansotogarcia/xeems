# Product Spec

## Product

XEEMS

## One-line Promise

Give administrators one control plane for company-issued phones and laptops, with a managed Windows desktop agent for always-on activity capture and a shift-based mobile app for field operations.

## Core Users

### Employee
- receives an admin-created account
- signs in once to enroll a company laptop
- uses the mobile app to start and end field shifts

### Admin
- provisions employees
- resets passwords
- disables or re-enables employees
- enables or disables enrolled desktop devices
- monitors shifts, geofence events, and desktop activity

## Primary Flows

1. Admin creates employee account
2. Employee signs in on desktop and enrolls the company laptop
3. Desktop agent persists across restart and reports activity until admin disable
4. Employee uses mobile to start and end field shifts
5. Mobile app sends shift-scoped location pings
6. Admin reviews dashboard activity and device health

## Product Principles

- Transparent deployment under written company notification
- Clear admin ownership of enrollment and monitoring controls
- No desktop employee stop path after enrollment
- Mobile collection limited to active shifts
- Role separation between employee apps and admin dashboard
