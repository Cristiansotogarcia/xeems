alter table public.profiles add column if not exists full_name text;

update public.profiles
set full_name = coalesce(nullif(trim(full_name), ''), nullif(split_part(email, '@', 1), ''), 'User')
where full_name is null or trim(full_name) = '';

alter table public.profiles alter column full_name set not null;
