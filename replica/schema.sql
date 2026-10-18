-- REMPLACÉ par clone/db/migrations/001_init.sql (comptes gérés par l'application, sans RLS). Conservé comme variante Supabase.
-- Schéma du clone de planification (périmètre : replica/recon.md, boucle principale)
-- Postgres (Supabase). Heures en timestamptz (UTC). Accès : row level security.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

-- Profil public lié à auth.users (Supabase Auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9-]{3,40}$'),
  display_name text not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Calendriers externes (OAuth). Jetons chiffrés côté application.
create table calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null check (provider in ('google','microsoft')),
  external_account text not null,
  refresh_token_enc text not null,
  check_busy boolean not null default true,
  write_bookings boolean not null default true,
  status text not null default 'active' check (status in ('active','revoked','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_account)
);
create index on calendar_connections (user_id);

-- Plages hebdomadaires. weekday 0=dimanche. Heures locales au fuseau du profil.
create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index on availability_rules (user_id, weekday);

-- Exceptions par date : plages vides = indisponible toute la journée
create table availability_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  on_date date not null,
  start_time time,
  end_time time,
  check ((start_time is null) = (end_time is null)),
  check (end_time is null or end_time > start_time)
);
create index on availability_overrides (user_id, on_date);

create table event_types (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null,
  color text not null default '#0b57d0',
  description text,
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  location_kind text not null default 'video'
    check (location_kind in ('video','phone','in_person','custom')),
  location_detail text,
  kind text not null default 'one_on_one' check (kind in ('one_on_one')), -- group/collective/round_robin : plus tard
  active boolean not null default true,
  min_notice_minutes integer not null default 240 check (min_notice_minutes >= 0),
  max_days_ahead integer not null default 60 check (max_days_ahead between 1 and 365),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes >= 0),
  limit_per_day integer check (limit_per_day > 0),
  limit_per_week integer check (limit_per_week > 0),
  slot_step_minutes integer not null default 30 check (slot_step_minutes between 5 and 240),
  confirmation_redirect_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);
create index on event_types (owner_id);

-- Questions du formulaire invité
create table event_type_questions (
  id uuid primary key default gen_random_uuid(),
  event_type_id uuid not null references event_types(id) on delete cascade,
  position integer not null,
  label text not null,
  kind text not null check (kind in ('text','textarea','select','checkbox')),
  options jsonb not null default '[]',
  required boolean not null default false,
  unique (event_type_id, position)
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  event_type_id uuid not null references event_types(id) on delete restrict,
  host_id uuid not null references profiles(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  guest_name text not null,
  guest_email text not null,
  guest_timezone text not null,
  answers jsonb not null default '{}',
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  cancel_reason text,
  cancelled_by text check (cancelled_by in ('host','guest')),
  rescheduled_from uuid references bookings(id) on delete set null,
  manage_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  external_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_zero_length check (end_at > start_at),
  -- Deux invités ne peuvent pas prendre le même créneau chez le même hôte
  constraint no_double_booking exclude using gist (
    host_id with =, tstzrange(start_at, end_at) with &&
  ) where (status = 'confirmed')
);
create index on bookings (host_id, start_at);
create index on bookings (event_type_id);
create index on bookings (guest_email);

-- Webhooks sortants
create table webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  url text not null check (url like 'https://%'),
  secret text not null,
  events text[] not null default '{booking.created,booking.cancelled}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on webhook_endpoints (user_id);

-- File de tâches : e-mails de confirmation, rappels, webhooks, synchro calendrier
create table jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email_confirmation','email_reminder','email_cancel','webhook','calendar_write')),
  booking_id uuid references bookings(id) on delete cascade,
  payload jsonb not null default '{}',
  run_at timestamptz not null default now(),
  attempts integer not null default 0,
  status text not null default 'pending' check (status in ('pending','done','failed')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index on jobs (status, run_at);

-- updated_at
create trigger t_profiles before update on profiles for each row execute function set_updated_at();
create trigger t_calconn before update on calendar_connections for each row execute function set_updated_at();
create trigger t_event_types before update on event_types for each row execute function set_updated_at();
create trigger t_bookings before update on bookings for each row execute function set_updated_at();

-- Row level security
alter table profiles enable row level security;
alter table calendar_connections enable row level security;
alter table availability_rules enable row level security;
alter table availability_overrides enable row level security;
alter table event_types enable row level security;
alter table event_type_questions enable row level security;
alter table bookings enable row level security;
alter table webhook_endpoints enable row level security;
alter table jobs enable row level security; -- aucune policy : service role seulement

create policy own_profile on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy own_calconn on calendar_connections for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rules on availability_rules for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_overrides on availability_overrides for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_event_types on event_types for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own_questions on event_type_questions for all
  using (exists (select 1 from event_types e where e.id = event_type_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from event_types e where e.id = event_type_id and e.owner_id = auth.uid()));
create policy host_bookings on bookings for select using (host_id = auth.uid());
create policy host_cancel on bookings for update using (host_id = auth.uid());
create policy own_webhooks on webhook_endpoints for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Lecture publique (invités) : uniquement via routes serveur avec la service role, jamais en direct.
