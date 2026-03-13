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
  permission_scope text not null,
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now(),
  constraint shifts_time_order check (ended_at is null or started_at is null or ended_at >= started_at)
);

create unique index if not exists shifts_one_active_per_user_idx on public.shifts (user_id) where status = 'active';

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when coalesce(new.raw_user_meta_data ->> 'role', 'worker') = 'admin' then 'admin' else 'worker' end
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin' and p.is_active = true
  );
$$;

create or replace function public.start_shift(p_site_id uuid default null, p_tracking_mode public.tracking_mode default 'background')
returns public.shifts
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := auth.uid();
  created_shift public.shifts;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_admin(current_user_id) then
    raise exception 'Owner/admin accounts cannot start employee tracking shifts';
  end if;

  if exists (select 1 from public.shifts where user_id = current_user_id and status = 'active') then
    raise exception 'User already has an active shift';
  end if;

  if not exists (
    select 1 from public.consent_records c
    where c.user_id = current_user_id
      and c.consent_version = 'v1'
      and c.consented_at >= now() - interval '30 days'
  ) then
    raise exception 'Recent consent record required before starting a shift';
  end if;

  insert into public.shifts (user_id, site_id, status, started_at, tracking_mode)
  values (current_user_id, p_site_id, 'active', now(), p_tracking_mode)
  returning * into created_shift;

  return created_shift;
end;
$$;

create or replace function public.end_my_active_shift()
returns public.shifts
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := auth.uid();
  ended_shift public.shifts;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.shifts
  set status = 'ended', ended_at = now()
  where user_id = current_user_id and status = 'active'
  returning * into ended_shift;

  if ended_shift.id is null then
    raise exception 'No active shift found';
  end if;

  return ended_shift;
end;
$$;

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.consent_records enable row level security;
alter table public.shifts enable row level security;
alter table public.location_pings enable row level security;
alter table public.geofence_events enable row level security;

drop policy if exists "workers can read own profile" on public.profiles;
create policy "workers can read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "admins can read profiles" on public.profiles;
create policy "admins can read profiles" on public.profiles
  for select using (public.is_admin(auth.uid()));

drop policy if exists "workers can update own profile" on public.profiles;
create policy "workers can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id and role = 'worker');

drop policy if exists "workers can read own shifts" on public.shifts;
create policy "workers can read own shifts" on public.shifts
  for select using (auth.uid() = user_id);

drop policy if exists "workers can manage own active shifts" on public.shifts;
create policy "workers can manage own active shifts" on public.shifts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id and not public.is_admin(auth.uid()));

drop policy if exists "workers can read own pings" on public.location_pings;
create policy "workers can read own pings" on public.location_pings
  for select using (auth.uid() = user_id);

drop policy if exists "workers can insert own pings during active shift" on public.location_pings;
create policy "workers can insert own pings during active shift" on public.location_pings
  for insert with check (
    auth.uid() = user_id and exists (
      select 1 from public.shifts s
      where s.id = shift_id and s.user_id = auth.uid() and s.status = 'active'
    )
  );

drop policy if exists "workers can read own consent" on public.consent_records;
create policy "workers can read own consent" on public.consent_records
  for select using (auth.uid() = user_id);

drop policy if exists "workers can insert own consent" on public.consent_records;
create policy "workers can insert own consent" on public.consent_records
  for insert with check (auth.uid() = user_id and not public.is_admin(auth.uid()));

drop policy if exists "admins can read operations data" on public.sites;
create policy "admins can read operations data" on public.sites
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admins can manage sites" on public.sites;
create policy "admins can manage sites" on public.sites
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admins can read all shifts" on public.shifts;
create policy "admins can read all shifts" on public.shifts
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all pings" on public.location_pings;
create policy "admins can read all pings" on public.location_pings
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all geofence events" on public.geofence_events;
create policy "admins can read all geofence events" on public.geofence_events
  for select using (public.is_admin(auth.uid()));

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
    values (
      new.shift_id,
      new.user_id,
      matched_site.id,
      'enter',
      new.captured_at,
      new.id,
      jsonb_build_object('note', 'MVP nearest-site placeholder logic')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_process_geofence_event on public.location_pings;
create trigger trg_process_geofence_event
after insert on public.location_pings
for each row execute function public.process_geofence_event();

comment on function public.start_shift(uuid, public.tracking_mode) is 'Starts an employee shift only when a recent consent record exists.';
comment on function public.end_my_active_shift() is 'Ends the current authenticated employee active shift and stops tracking scope.';
