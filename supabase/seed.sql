-- XEEMS Seed Data
-- Run after schema.sql. Safe to edit names/coordinates.

-- Existing site data
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

-- XEEMS: Application categorization rules
insert into public.app_categories (app_name_pattern, category, is_system) values
-- Productive applications
  ('code', 'productive', true),
  ('visual studio', 'productive', true),
  ('vs code', 'productive', true),
  ('notepad++', 'productive', true),
  ('sublime text', 'productive', true),
  ('terminal', 'productive', true),
  ('powershell', 'productive', true),
  ('cmd', 'productive', true),
  ('excel', 'productive', true),
  ('word', 'productive', true),
  ('powerpoint', 'productive', true),
  ('outlook', 'productive', true),
  ('teams', 'productive', true),
  ('slack', 'productive', true),
  ('notion', 'productive', true),
  ('obsidian', 'productive', true),
  ('figma', 'productive', true),
  ('adobe', 'productive', true),
  ('github', 'productive', true),
  ('git', 'productive', true),
  ('chrome', 'neutral', true),
  ('firefox', 'neutral', true),
  ('edge', 'neutral', true),
  ('safari', 'neutral', true),
  
-- Social media (to flag)
  ('facebook', 'social_media', true),
  ('twitter', 'social_media', true),
  ('x.com', 'social_media', true),
  ('instagram', 'social_media', true),
  ('tiktok', 'social_media', true),
  ('youtube', 'social_media', true),
  ('reddit', 'social_media', true),
  ('discord', 'social_media', true),
  ('whatsapp', 'social_media', true),
  ('telegram', 'social_media', true),
  ('linkedin', 'social_media', true),
  ('snapchat', 'social_media', true),
  ('pinterest', 'social_media', true),
  
-- Restricted applications
  ('torrent', 'restricted', true),
  ('utorrent', 'restricted', true),
  ('spotify', 'restricted', true)
on conflict do nothing;

-- XEEMS: Default alert configurations
-- Note: owner_id will be set after the admin user is created. 
-- Run this after creating the admin user:
-- insert into public.alert_configs (owner_id, alert_type, threshold_minutes, is_enabled, notify_employee) 
-- select id, 'excessive_idle', 30, true, false from public.profiles where role = 'admin' limit 1;
-- insert into public.alert_configs (owner_id, alert_type, threshold_minutes, is_enabled, notify_employee) 
-- select id, 'social_media', 15, true, false from public.profiles where role = 'admin' limit 1;
-- insert into public.alert_configs (owner_id, alert_type, threshold_minutes, is_enabled, notify_employee) 
-- select id, 'no_activity', 60, true, true from public.profiles where role = 'admin' limit 1;
-- insert into public.alert_configs (owner_id, alert_type, threshold_minutes, is_enabled, notify_employee) 
-- select id, 'low_productivity', 0, false, false from public.profiles where role = 'admin' limit 1;

-- After creating users in Supabase Auth, promote the owner account manually:
-- update public.profiles set role = 'admin' where id = '<OWNER_USER_UUID>';
