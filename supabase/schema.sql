create extension if not exists pgcrypto;

create type public.user_role as enum ('worker', 'admin');
create type public.shift_status as enum ('scheduled', 'active', 'ended', 'cancelled');
create type public.tracking_mode as enum ('foreground', 'background');
create type public.geofence_event_type as enum ('enter', 'exit', 'dwell');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'worker',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null check (radius_meters > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_version text not null,
  consented_at timestamptz not null default now(),
  device_platform text,
  permission_scope text not null
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  site_id uuid references public.sites(id),
  status public.shift_status not null default 'scheduled',
  started_at timestamptz,
  ended_at timestamptz,
  tracking_mode public.tracking_mode,
  started_latitude double precision,
  started_longitude double precision,
  ended_latitude double precision,
  ended_longitude double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.location_pings (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision,
  speed_mps double precision,
  captured_at timestamptz not null,
  source text not null check (source in ('foreground', 'background', 'manual')),
  created_at timestamptz not null default now()
);

create table if not exists public.geofence_events (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  event_type public.geofence_event_type not null,
  event_at timestamptz not null,
  derived_from_ping_id uuid references public.location_pings(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.consent_records enable row level security;
alter table public.shifts enable row level security;
alter table public.location_pings enable row level security;
alter table public.geofence_events enable row level security;

create policy "workers can read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "admins can read profiles" on public.profiles
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "workers can read own shifts" on public.shifts
  for select using (auth.uid() = user_id);

create policy "workers can manage own active shifts" on public.shifts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "workers can read own pings" on public.location_pings
  for select using (auth.uid() = user_id);

create policy "workers can insert own pings during active shift" on public.location_pings
  for insert with check (
    auth.uid() = user_id and exists (
      select 1 from public.shifts s
      where s.id = shift_id and s.user_id = auth.uid() and s.status = 'active'
    )
  );

create policy "workers can read own consent" on public.consent_records
  for select using (auth.uid() = user_id);

create policy "workers can insert own consent" on public.consent_records
  for insert with check (auth.uid() = user_id);

create policy "admins can read operations data" on public.sites
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admins can read all shifts" on public.shifts
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admins can read all pings" on public.location_pings
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admins can read all geofence events" on public.geofence_events
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.process_geofence_event()
returns trigger
language plpgsql
as $$
declare
  matched_site public.sites;
begin
  select * into matched_site
  from public.sites s
  where s.is_active = true
  order by power(s.latitude - new.latitude, 2) + power(s.longitude - new.longitude, 2)
  limit 1;

  if matched_site.id is not null then
    insert into public.geofence_events (shift_id, user_id, site_id, event_type, event_at, derived_from_ping_id, metadata)
    values (new.shift_id, new.user_id, matched_site.id, 'enter', new.captured_at, new.id, jsonb_build_object('note', 'MVP nearest-site placeholder logic'));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_process_geofence_event on public.location_pings;
create trigger trg_process_geofence_event
after insert on public.location_pings
for each row execute function public.process_geofence_event();
