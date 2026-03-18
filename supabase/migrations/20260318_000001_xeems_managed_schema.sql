create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('worker', 'admin');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'shift_status') then
    create type public.shift_status as enum ('scheduled', 'active', 'ended', 'cancelled');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tracking_mode') then
    create type public.tracking_mode as enum ('foreground', 'background');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'geofence_event_type') then
    create type public.geofence_event_type as enum ('enter', 'exit', 'dwell');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'shift_break_type') then
    create type public.shift_break_type as enum ('lunch', 'pause');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null,
  role public.user_role not null default 'worker',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Add is_active column if it doesn't exist (for existing databases)
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists is_active boolean not null default true;
create unique index if not exists profiles_email_unique_idx on public.profiles (lower(email)) where email is not null;

-- Define the is_admin function BEFORE any tables that depend on it
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin' and p.is_active = true
  );
$$;

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country_code text not null default 'AW',
  timezone text not null default 'America/Aruba',
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null check (radius_meters > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.sites add column if not exists client_name text;
alter table public.sites add column if not exists address_line_1 text;
alter table public.sites add column if not exists address_line_2 text;
alter table public.sites add column if not exists city text;
alter table public.sites add column if not exists region text;
alter table public.sites add column if not exists postal_code text;
alter table public.sites add column if not exists country_code text not null default 'AW';
alter table public.sites add column if not exists timezone text not null default 'America/Aruba';

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_version text not null,
  consented_at timestamptz not null default now(),
  device_platform text,
  permission_scope text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists consent_records_unique_scope_per_day_idx
  on public.consent_records (user_id, consent_version, permission_scope, ((consented_at at time zone 'utc')::date));

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

create table if not exists public.shift_breaks (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  break_type public.shift_break_type not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint shift_breaks_time_order check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists shift_breaks_one_active_per_shift_idx on public.shift_breaks (shift_id) where ended_at is null;
create index if not exists shift_breaks_user_idx on public.shift_breaks (user_id, started_at desc);

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

create table if not exists public.desktop_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_uuid text not null unique,
  device_name text,
  os_username text,
  app_version text,
  enrollment_status text not null default 'enrolled' check (enrollment_status in ('pending', 'enrolled', 'disabled')),
  monitoring_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists desktop_devices_user_idx on public.desktop_devices (user_id);
create index if not exists desktop_devices_monitoring_idx on public.desktop_devices (monitoring_enabled, enrollment_status);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when coalesce(new.raw_user_meta_data ->> 'role', 'worker') = 'admin' then 'admin' else 'worker' end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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

  insert into public.shifts (user_id, site_id, status, started_at, tracking_mode)
  values (current_user_id, p_site_id, 'active', now(), p_tracking_mode)
  returning * into created_shift;

  return created_shift;
end;
$$;

create or replace function public.start_my_shift_break(p_break_type public.shift_break_type)
returns public.shift_breaks
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := auth.uid();
  current_shift public.shifts;
  created_break public.shift_breaks;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_admin(current_user_id) then
    raise exception 'Owner/admin accounts cannot start employee breaks';
  end if;

  select *
  into current_shift
  from public.shifts
  where user_id = current_user_id and status = 'active'
  order by created_at desc
  limit 1;

  if current_shift.id is null then
    raise exception 'No active shift found';
  end if;

  if exists (
    select 1
    from public.shift_breaks sb
    where sb.shift_id = current_shift.id and sb.ended_at is null
  ) then
    raise exception 'An active break already exists for this shift';
  end if;

  insert into public.shift_breaks (shift_id, user_id, break_type, started_at)
  values (current_shift.id, current_user_id, p_break_type, now())
  returning * into created_break;

  return created_break;
end;
$$;

create or replace function public.end_my_active_break()
returns public.shift_breaks
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := auth.uid();
  ended_break public.shift_breaks;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.shift_breaks
  set ended_at = now()
  where id = (
    select sb.id
    from public.shift_breaks sb
    where sb.user_id = current_user_id and sb.ended_at is null
    order by sb.started_at desc
    limit 1
  )
  returning * into ended_break;

  if ended_break.id is null then
    raise exception 'No active break found';
  end if;

  return ended_break;
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

  update public.shift_breaks
  set ended_at = now()
  where user_id = current_user_id and ended_at is null;

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
alter table public.shift_breaks enable row level security;
alter table public.location_pings enable row level security;
alter table public.geofence_events enable row level security;
alter table public.desktop_devices enable row level security;

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

drop policy if exists "workers can read own shift breaks" on public.shift_breaks;
create policy "workers can read own shift breaks" on public.shift_breaks
  for select using (auth.uid() = user_id);

drop policy if exists "workers can manage own shift breaks" on public.shift_breaks;
create policy "workers can manage own shift breaks" on public.shift_breaks
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
    ) and not exists (
      select 1 from public.shift_breaks sb
      where sb.shift_id = shift_id and sb.user_id = auth.uid() and sb.ended_at is null
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

drop policy if exists "workers can read sites for shift selection" on public.sites;
create policy "workers can read sites for shift selection" on public.sites
  for select using (is_active = true and not public.is_admin(auth.uid()));

drop policy if exists "admins can read all shifts" on public.shifts;
create policy "admins can read all shifts" on public.shifts
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all shift breaks" on public.shift_breaks;
create policy "admins can read all shift breaks" on public.shift_breaks
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all pings" on public.location_pings;
create policy "admins can read all pings" on public.location_pings
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all geofence events" on public.geofence_events;
create policy "admins can read all geofence events" on public.geofence_events
  for select using (public.is_admin(auth.uid()));

drop policy if exists "workers can read own desktop devices" on public.desktop_devices;
create policy "workers can read own desktop devices" on public.desktop_devices
  for select using (auth.uid() = user_id);

drop policy if exists "workers can enroll own desktop devices" on public.desktop_devices;
create policy "workers can enroll own desktop devices" on public.desktop_devices
  for insert with check (
    auth.uid() = user_id
    and not public.is_admin(auth.uid())
    and monitoring_enabled = true
    and enrollment_status in ('pending', 'enrolled')
  );

drop policy if exists "workers can update own enrolled desktop devices" on public.desktop_devices;
create policy "workers can update own enrolled desktop devices" on public.desktop_devices
  for update using (
    auth.uid() = user_id
    and monitoring_enabled = true
    and enrollment_status in ('pending', 'enrolled')
  )
  with check (
    auth.uid() = user_id
    and not public.is_admin(auth.uid())
    and monitoring_enabled = true
    and enrollment_status in ('pending', 'enrolled')
  );

drop policy if exists "admins can manage desktop devices" on public.desktop_devices;
create policy "admins can manage desktop devices" on public.desktop_devices
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

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

comment on function public.start_shift(uuid, public.tracking_mode) is 'Starts an employee shift for notification-based company-device tracking.';
comment on function public.start_my_shift_break(public.shift_break_type) is 'Starts a worker lunch or pause break during the active shift and pauses mobile tracking.';
comment on function public.end_my_active_break() is 'Ends the authenticated worker active break and allows mobile tracking to resume.';
comment on function public.end_my_active_shift() is 'Ends the current authenticated employee active shift and stops tracking scope.';

-- ============================================
-- XEEMS: Employee Efficiency Monitoring Tables
-- ============================================

-- Activity logs from desktop/mobile clients
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.desktop_devices(id) on delete set null,
  device_type text not null check (device_type in ('laptop', 'mobile')),
  timestamp timestamptz not null default now(),
  activity_type text not null check (activity_type in ('app_focus', 'idle', 'screenshot', 'web_activity', 'active')),
  app_name text,
  window_title text,
  duration_seconds integer,
  is_productive boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Idle time tracking
create table if not exists public.idle_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.desktop_devices(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

-- Application categorization rules
create table if not exists public.app_categories (
  id uuid primary key default gen_random_uuid(),
  app_name_pattern text not null,
  category text not null check (category in ('productive', 'social_media', 'neutral', 'restricted')),
  is_system boolean default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Daily productivity scores
create table if not exists public.daily_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  productive_time_minutes integer default 0,
  idle_time_minutes integer default 0,
  social_media_time_minutes integer default 0,
  total_active_time_minutes integer default 0,
  score decimal(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

-- Alert configurations for admins
create table if not exists public.alert_configs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  alert_type text not null check (alert_type in ('excessive_idle', 'social_media', 'no_activity', 'low_productivity')),
  threshold_minutes integer not null,
  is_enabled boolean default true,
  notify_employee boolean default false,
  created_at timestamptz not null default now()
);

-- Generated alerts
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  alert_type text not null,
  message text,
  severity text default 'info' check (severity in ('info', 'warning', 'critical')),
  acknowledged boolean default false,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

-- Enable RLS on new tables
alter table public.activity_logs enable row level security;
alter table public.idle_events enable row level security;
alter table public.app_categories enable row level security;
alter table public.daily_scores enable row level security;
alter table public.alert_configs enable row level security;
alter table public.alerts enable row level security;

alter table public.activity_logs add column if not exists device_id uuid references public.desktop_devices(id) on delete set null;
alter table public.idle_events add column if not exists device_id uuid references public.desktop_devices(id) on delete set null;

-- RLS Policies for activity_logs
drop policy if exists "employees can insert own activity logs" on public.activity_logs;
create policy "employees can insert own activity logs" on public.activity_logs
  for insert with check (
    auth.uid() = user_id
    and (
      device_id is null
      or exists (
        select 1 from public.desktop_devices d
        where d.id = device_id
          and d.user_id = auth.uid()
          and d.enrollment_status = 'enrolled'
          and d.monitoring_enabled = true
      )
    )
  );

drop policy if exists "employees can read own activity logs" on public.activity_logs;
create policy "employees can read own activity logs" on public.activity_logs
  for select using (auth.uid() = user_id);

drop policy if exists "admins can read all activity logs" on public.activity_logs;
create policy "admins can read all activity logs" on public.activity_logs
  for select using (public.is_admin(auth.uid()));

-- RLS Policies for idle_events
drop policy if exists "employees can insert own idle events" on public.idle_events;
create policy "employees can insert own idle events" on public.idle_events
  for insert with check (
    auth.uid() = user_id
    and (
      device_id is null
      or exists (
        select 1 from public.desktop_devices d
        where d.id = device_id
          and d.user_id = auth.uid()
          and d.enrollment_status = 'enrolled'
          and d.monitoring_enabled = true
      )
    )
  );

drop policy if exists "employees can read own idle events" on public.idle_events;
create policy "employees can read own idle events" on public.idle_events
  for select using (auth.uid() = user_id);

drop policy if exists "admins can read all idle events" on public.idle_events;
create policy "admins can read all idle events" on public.idle_events
  for select using (public.is_admin(auth.uid()));

-- RLS Policies for daily_scores
drop policy if exists "employees can read own scores" on public.daily_scores;
create policy "employees can read own scores" on public.daily_scores
  for select using (auth.uid() = user_id);

drop policy if exists "admins can manage all scores" on public.daily_scores;
create policy "admins can manage all scores" on public.daily_scores
  for all using (public.is_admin(auth.uid()));

-- RLS Policies for app_categories
drop policy if exists "admins can manage app categories" on public.app_categories;
create policy "admins can manage app categories" on public.app_categories
  for all using (public.is_admin(auth.uid()));

-- RLS Policies for alert_configs
drop policy if exists "admins can manage alert configs" on public.alert_configs;
create policy "admins can manage alert configs" on public.alert_configs
  for all using (public.is_admin(auth.uid()));

-- RLS Policies for alerts
drop policy if exists "employees can read own alerts" on public.alerts;
create policy "employees can read own alerts" on public.alerts
  for select using (auth.uid() = user_id);

drop policy if exists "employees can acknowledge own alerts" on public.alerts;
create policy "employees can acknowledge own alerts" on public.alerts
  for update using (auth.uid() = user_id) with check (acknowledged = true);

drop policy if exists "admins can manage all alerts" on public.alerts;
create policy "admins can manage all alerts" on public.alerts
  for all using (public.is_admin(auth.uid()));

-- Function to calculate daily productivity score
create or replace function public.calculate_daily_score(p_user_id uuid, p_date date)
returns void
language plpgsql
as $$
declare
  v_productive_time integer := 0;
  v_idle_time integer := 0;
  v_social_media_time integer := 0;
  v_total_time integer := 0;
  v_score decimal(5,2) := 0;
begin
  -- Get productive time
  select coalesce(sum(duration_seconds), 0) / 60 into v_productive_time
  from public.activity_logs
  where user_id = p_user_id
    and timestamp::date = p_date
    and is_productive = true;

  -- Get idle time
  select coalesce(sum(duration_seconds), 0) / 60 into v_idle_time
  from public.idle_events
  where user_id = p_user_id
    and start_time::date = p_date;

  -- Get social media time
  select coalesce(sum(duration_seconds), 0) / 60 into v_social_media_time
  from public.activity_logs
  where user_id = p_user_id
    and timestamp::date = p_date
    and (metadata->>'category') = 'social_media';

  -- Calculate total active time
  v_total_time := v_productive_time + v_idle_time + v_social_media_time;

  -- Calculate score (productive time / total time * 100)
  if v_total_time > 0 then
    v_score := (v_productive_time::decimal / v_total_time) * 100;
  end if;

  -- Upsert daily score
  insert into public.daily_scores (user_id, date, productive_time_minutes, idle_time_minutes, social_media_time_minutes, total_active_time_minutes, score, updated_at)
  values (p_user_id, p_date, v_productive_time, v_idle_time, v_social_media_time, v_total_time, v_score, now())
  on conflict (user_id, date) do update
    set productive_time_minutes = v_productive_time,
        idle_time_minutes = v_idle_time,
        social_media_time_minutes = v_social_media_time,
        total_active_time_minutes = v_total_time,
        score = v_score,
        updated_at = now();
end;
$$;
