-- ================================================================
-- T-Break — Complete Supabase schema
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New query
-- ================================================================

create extension if not exists "uuid-ossp";

-- ================================================================
-- Profiles (linked to Supabase Auth users)
-- ================================================================
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text unique not null,
  name               text not null,
  is_leader          boolean not null default false,
  approved           boolean not null default false,
  team               text default null,           -- 'klantenservice' | 'commercieel' | 'freedom' | NULL
  team_changed_date  text default null,           -- 'YYYY-MM-DD' — tracks self-switch usage
  created_at         timestamptz not null default now()
);

-- ================================================================
-- Invites (admin pre-approves an email before registration)
-- ================================================================
create table if not exists public.invites (
  id         uuid primary key default uuid_generate_v4(),
  email      text unique not null,
  name       text not null,
  is_leader  boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  claimed    boolean not null default false
);

-- ================================================================
-- Shared app state — single row (id=1) holds all live state
-- ================================================================
create table if not exists public.app_state (
  id              int primary key default 1,
  config          jsonb not null default '{}',
  active_breaks   jsonb not null default '{"klantenservice":[],"commercieel":[],"freedom":[]}',
  queues          jsonb not null default '{"klantenservice":{"brb":[],"short":[],"lunch":[]},"commercieel":{"brb":[],"short":[],"lunch":[]},"freedom":{"brb":[],"short":[],"lunch":[]}}',
  usage           jsonb not null default '{}',
  sessions        jsonb not null default '{}',
  extra_breaks    jsonb not null default '{}',
  default_config  jsonb,
  total_time      jsonb not null default '{}',
  log             jsonb not null default '[]',
  last_date       text,
  updated_at      timestamptz not null default now(),
  check (id = 1)
);

-- Insert the single row if it doesn't exist, with per-team config defaults
insert into public.app_state (id, config) values (
  1,
  '{
    "klantenservice": {"brbPool":2,"shortPool":4,"lunchPool":2,"brbDurationSec":180,"shortDurationSec":900,"shortPerDay":2,"lunchDurationSec":1800,"lunchPerDay":1},
    "commercieel":    {"brbPool":2,"shortPool":4,"lunchPool":2,"brbDurationSec":180,"shortDurationSec":900,"shortPerDay":2,"lunchDurationSec":1800,"lunchPerDay":1},
    "freedom":        {"brbPool":2,"shortPool":4,"lunchPool":2,"brbDurationSec":180,"shortDurationSec":900,"shortPerDay":2,"lunchDurationSec":1800,"lunchPerDay":1}
  }'::jsonb
) on conflict (id) do nothing;

-- ================================================================
-- Logs (persistent daily archive, queryable)
-- ================================================================
create table if not exists public.logs (
  id           bigserial primary key,
  log_date     date not null default current_date,
  kind         text not null default 'break',  -- 'break' | 'admin'
  -- break fields
  user_id      uuid references public.profiles(id),
  user_name    text,
  break_type   text,                           -- 'brb' | 'short' | 'lunch'
  started_at   timestamptz,
  ended_at     timestamptz,
  end_reason   text,                           -- 'early' | 'timer' | 'leader-ended' | 'forfeit'
  duration_ms  bigint generated always as (
    case when ended_at is not null and started_at is not null
      then extract(epoch from (ended_at - started_at)) * 1000
      else null
    end
  ) stored,
  -- admin fields
  admin_id     uuid references public.profiles(id),
  admin_name   text,
  action       text,                           -- 'reset' | 'ticket-add' | etc.
  action_data  jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists logs_date_idx  on public.logs (log_date desc);
create index if not exists logs_user_idx  on public.logs (user_id, log_date desc);

-- ================================================================
-- Team change requests (employee requests 2nd+ switch of the day)
-- ================================================================
create table if not exists public.team_change_requests (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete cascade,
  user_name     text not null,
  from_team     text,
  to_team       text not null,
  requested_at  timestamptz not null default now(),
  status        text not null default 'pending' -- 'pending' | 'approved' | 'denied'
);

-- ================================================================
-- Row Level Security
-- ================================================================
alter table public.profiles              enable row level security;
alter table public.invites               enable row level security;
alter table public.app_state             enable row level security;
alter table public.logs                  enable row level security;
alter table public.team_change_requests  enable row level security;

-- Profiles: everyone can read, users update their own, leaders update anyone
drop policy if exists "profiles_read"    on public.profiles;
drop policy if exists "profiles_insert"  on public.profiles;
drop policy if exists "profiles_update"  on public.profiles;
drop policy if exists "leader_approve"   on public.profiles;
create policy "profiles_read"   on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);
create policy "leader_approve"  on public.profiles for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_leader = true));

-- Invites: leaders only
drop policy if exists "invites_read"   on public.invites;
drop policy if exists "invites_insert" on public.invites;
create policy "invites_read"   on public.invites for select using (true);
create policy "invites_insert" on public.invites for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_leader = true));

-- App state: approved users have full access
drop policy if exists "appstate_read"   on public.app_state;
drop policy if exists "appstate_update" on public.app_state;
drop policy if exists "appstate_insert" on public.app_state;
drop policy if exists "appstate_all"    on public.app_state;
create policy "appstate_all" on public.app_state for all
  using (exists (select 1 from public.profiles where id = auth.uid() and approved = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and approved = true));

-- Logs: approved users can insert, leaders read all, users read own
drop policy if exists "logs_insert"     on public.logs;
drop policy if exists "logs_read_leader" on public.logs;
drop policy if exists "logs_read_own"   on public.logs;
create policy "logs_insert" on public.logs for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and approved = true));
create policy "logs_read_leader" on public.logs for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_leader = true));
create policy "logs_read_own" on public.logs for select
  using (user_id = auth.uid());

-- Team change requests: users insert their own, leaders read/update all
drop policy if exists "tcr_read_leader"    on public.team_change_requests;
drop policy if exists "tcr_insert_own"     on public.team_change_requests;
drop policy if exists "tcr_update_leader"  on public.team_change_requests;
create policy "tcr_read_leader" on public.team_change_requests for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_leader = true));
create policy "tcr_insert_own" on public.team_change_requests for insert
  with check (user_id = auth.uid());
create policy "tcr_update_leader" on public.team_change_requests for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_leader = true));

-- ================================================================
-- Realtime publications — app_state + team_change_requests
-- Fire-and-forget; ignore if already in the publication.
-- ================================================================
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.app_state';
  exception when duplicate_object then null;
  end;
  begin execute 'alter publication supabase_realtime add table public.team_change_requests';
  exception when duplicate_object then null;
  end;
  begin execute 'alter publication supabase_realtime add table public.profiles';
  exception when duplicate_object then null;
  end;
end $$;

-- ================================================================
-- Auto-create profile when a new auth user signs up
-- Uses invite if present, otherwise creates unapproved profile
-- ================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  invite public.invites%rowtype;
begin
  select * into invite from public.invites
  where email = new.email and claimed = false
  limit 1;

  if found then
    insert into public.profiles (id, email, name, is_leader, approved)
    values (new.id, new.email, invite.name, invite.is_leader, true);
    update public.invites set claimed = true where id = invite.id;
  else
    insert into public.profiles (id, email, name, is_leader, approved)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
      false,
      false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ================================================================
-- Done! Next steps:
-- 1. Authentication → Providers → Email: enable, "Confirm email" OFF
-- 2. Register your first account via the app
-- 3. Set approved=true + is_leader=true on your row in public.profiles
-- 4. Log in — you can now approve everyone else from the UI
-- ================================================================
