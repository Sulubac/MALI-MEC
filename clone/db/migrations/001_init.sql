-- Schéma initial. Adapté de replica/schema.sql : comptes gérés par l'application
-- (table users) au lieu de Supabase Auth ; accès contrôlé par la couche de données
-- (chaque fonction filtre par propriétaire), pas par RLS.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

-- ---------- Comptes et sessions ----------
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Adresse unique sans tenir compte de la casse
create unique index users_email_lower_key on users (lower(email));

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,        -- sha256 du jeton du cookie : le jeton lui-même n'est jamais stocké
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on sessions (user_id);
create index on sessions (expires_at);

create table email_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  purpose text not null check (purpose in ('verify_email','reset_password')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on email_tokens (user_id, purpose);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

-- ---------- Profil et disponibilités ----------
create table profiles (
  id uuid primary key references users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9-]{3,40}$'),
  display_name text not null check (length(display_name) between 1 and 80),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index on availability_rules (user_id, weekday);

-- Une ligne par plage ; une ligne sans heures = indisponible toute la journée
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

-- ---------- Types d'événements et réservations ----------
create table event_types (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null,
  color text not null default 'var(--color-accent)',
  description text not null default '',
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  location_kind text not null default 'video' check (location_kind in ('video','phone','in_person','custom')),
  location_detail text not null default '',
  kind text not null default 'one_on_one' check (kind in ('one_on_one')),
  active boolean not null default true,
  min_notice_minutes integer not null default 240 check (min_notice_minutes >= 0),
  max_days_ahead integer not null default 60 check (max_days_ahead between 1 and 365),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes >= 0),
  limit_per_day integer check (limit_per_day > 0),
  limit_per_week integer check (limit_per_week > 0),
  slot_step_minutes integer not null default 30 check (slot_step_minutes between 5 and 240),
  questions jsonb not null default '[]',
  confirmation_redirect_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);
create index on event_types (owner_id);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  event_type_id uuid not null references event_types(id),   -- NO ACTION : vérifié en fin d'instruction, la suppression en cascade d'un compte passe
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
create index on bookings (lower(guest_email));

-- ---------- Webhooks sortants, file de tâches, courrier ----------
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

create table jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email','webhook','calendar_write')),
  payload jsonb not null default '{}',
  run_at timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  last_error text,                     -- journal des échecs : un job « failed » est la file des lettres mortes
  locked_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on jobs (status, run_at);

-- Courrier de développement : rempli quand aucune clé d'envoi n'est configurée (jamais en production)
create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_address text not null,
  subject text not null,
  body_text text not null,
  created_at timestamptz not null default now()
);

create trigger t_users before update on users for each row execute function set_updated_at();
create trigger t_profiles before update on profiles for each row execute function set_updated_at();
create trigger t_event_types before update on event_types for each row execute function set_updated_at();
create trigger t_bookings before update on bookings for each row execute function set_updated_at();
