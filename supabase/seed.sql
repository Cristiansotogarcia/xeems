-- Minimal Aruba-friendly seed data for local MVP testing.
-- Run after schema.sql. Safe to edit names/coordinates.

insert into public.sites (
  name,
  client_name,
  address_line_1,
  city,
  region,
  postal_code,
  country_code,
  timezone,
  latitude,
  longitude,
  radius_meters,
  is_active
)
values
  (
    'Palm Beach Hotel Site',
    'Aruba Hospitality Group',
    'J.E. Irausquin Blvd 85',
    'Noord',
    'Aruba',
    null,
    'AW',
    'America/Aruba',
    12.5719,
    -70.0460,
    120,
    true
  ),
  (
    'Oranjestad Marina Office',
    'Harbor Services Aruba',
    'L.G. Smith Blvd 9',
    'Oranjestad',
    'Aruba',
    null,
    'AW',
    'America/Aruba',
    12.5186,
    -70.0358,
    90,
    true
  )
on conflict do nothing;

-- After creating users in Supabase Auth, promote the owner account manually:
-- update public.profiles set role = 'admin' where id = '<OWNER_USER_UUID>';
