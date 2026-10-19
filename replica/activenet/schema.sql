-- ActiveNet clone schema (Postgres 16). Clean-room, derived from recon.md (inferred).
-- Access rule: no RLS. Every query goes through lib/data layer functions that take (orgId, actor)
-- and always filter by org_id; citizen queries also filter by account_id. Tested in unit tests.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  timezone text not null,                       -- IANA, local time of its facilities
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  min_age_account int not null default 13,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table users (                            -- one login = one household account or staff member
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,                           -- null when created by staff at the front desk, not yet claimed
  email_verified_at timestamptz,
  org_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on users (org_id);

create table staff_members (
  user_id uuid primary key references users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('admin','manager','front_desk','instructor')),
  created_at timestamptz not null default now()
);
create index on staff_members (org_id);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on sessions (user_id);

create table auth_tokens (                      -- email verification and password reset
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('verify','reset')),
  expires_at timestamptz not null, used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on auth_tokens (user_id);

create table persons (                          -- household members
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  account_id uuid not null references users(id) on delete cascade,
  first_name text not null, last_name text not null,
  birthdate date not null,
  notes text not null default '',               -- allergies etc; minimal, GDPR-deletable
  is_account_holder boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on persons (account_id);
create index on persons (org_id);

create table locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null, address text not null default '',
  created_at timestamptz not null default now()
);
create index on locations (org_id);

create table facilities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete restrict,
  name text not null, kind text not null,       -- room, court, field...
  hourly_fee_cents int not null default 0 check (hourly_fee_cents >= 0),
  min_minutes int not null default 30 check (min_minutes > 0),
  max_minutes int not null default 240 check (max_minutes >= min_minutes),
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on facilities (org_id, kind);
create index on facilities (location_id);

create table facility_hours (                   -- weekly local opening hours
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  opens time not null, closes time not null,
  check (closes > opens)
);
create index on facility_hours (facility_id, weekday);

create table activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  title text not null, category text not null, description text not null default '',
  starts_on date not null, ends_on date not null,
  schedule_text text not null default '',       -- shown to users, e.g. "Tue 18:00-19:00"
  fee_cents int not null check (fee_cents >= 0),
  capacity int not null check (capacity >= 0),
  spots_taken int not null default 0,
  min_age int, max_age int,
  waitlist_enabled boolean not null default true,
  status text not null default 'draft' check (status in ('draft','published','closed','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (spots_taken >= 0 and spots_taken <= capacity),   -- overbooking impossible at DB level
  check (min_age is null or max_age is null or max_age >= min_age)
);
create index on activities (org_id, status, starts_on);
create index on activities (org_id, category);

create table activity_questions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  position int not null, label text not null,
  kind text not null check (kind in ('text','choice','yesno')),
  options jsonb not null default '[]', required boolean not null default false
);
create index on activity_questions (activity_id, position);

create table waivers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null, body text not null, version int not null default 1,
  created_at timestamptz not null default now()
);
create index on waivers (org_id);
alter table activities add column waiver_id uuid references waivers(id) on delete set null;

create table orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  account_id uuid not null references users(id) on delete restrict,
  status text not null default 'cart' check (status in ('cart','pending_payment','paid','failed','cancelled','refunded','partially_refunded')),
  currency text not null, total_cents int not null default 0 check (total_cents >= 0),
  hold_expires_at timestamptz,                  -- cart holds spots until here
  stripe_session_id text unique,
  placed_by uuid references users(id),          -- staff user for front-desk sales
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on orders (account_id, status);
create index on orders (org_id, status, created_at);
create unique index one_open_cart on orders (account_id) where status = 'cart';

create table registrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  person_id uuid not null references persons(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  status text not null check (status in ('held','confirmed','waitlisted','offered','cancelled','expired')),
  price_cents int not null check (price_cents >= 0),
  answers jsonb not null default '{}',
  waiver_id uuid references waivers(id), waiver_signed_name text, waiver_signed_at timestamptz,
  waitlist_position int,                        -- set only while waitlisted
  offer_expires_at timestamptz,                 -- while 'offered'
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on registrations (activity_id, status);
create index on registrations (person_id);
create index on registrations (order_id);
create unique index one_live_registration on registrations (activity_id, person_id)
  where status in ('held','confirmed','waitlisted','offered');   -- no duplicate sign-up

create table order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  kind text not null check (kind in ('registration','pass','reservation','dropin')),
  ref_id uuid not null, description text not null,
  amount_cents int not null check (amount_cents >= 0)
);
create index on order_lines (order_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  kind text not null check (kind in ('charge','refund')),
  amount_cents int not null check (amount_cents > 0),
  method text not null check (method in ('card','cash','other')),
  stripe_id text unique,                        -- idempotency for webhooks
  created_at timestamptz not null default now()
);
create index on payments (order_id);

create table stripe_events (id text primary key, received_at timestamptz not null default now());

create table pass_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null, fee_cents int not null check (fee_cents >= 0),
  valid_days int not null check (valid_days > 0), allows_auto_renew boolean not null default false,
  active boolean not null default true
);
create index on pass_types (org_id);

create table pass_holdings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  pass_type_id uuid not null references pass_types(id) on delete restrict,
  person_id uuid not null references persons(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  valid_from date not null, valid_to date not null,
  auto_renew boolean not null default false,
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  created_at timestamptz not null default now(), check (valid_to >= valid_from)
);
create index on pass_holdings (person_id, status);
create index on pass_holdings (valid_to) where auto_renew and status = 'active';

create table reservations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  facility_id uuid not null references facilities(id) on delete restrict,
  account_id uuid not null references users(id) on delete restrict,
  order_id uuid references orders(id) on delete set null,
  starts_at timestamptz not null, ends_at timestamptz not null,
  purpose text not null default '', fee_cents int not null check (fee_cents >= 0),
  status text not null check (status in ('held','confirmed','cancelled')),
  hold_expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  exclude using gist (facility_id with =, tstzrange(starts_at, ends_at) with &&)
    where (status in ('held','confirmed'))      -- double booking impossible at DB level
);
create index on reservations (account_id);
create index on reservations (facility_id, starts_at);

create table dropin_sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  starts_at timestamptz not null, capacity int not null check (capacity > 0),
  taken int not null default 0, check (taken between 0 and capacity)
);
create index on dropin_sessions (activity_id, starts_at);

create table dropin_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references dropin_sessions(id) on delete cascade,
  person_id uuid not null references persons(id) on delete cascade,
  status text not null default 'reserved' check (status in ('reserved','checked_in','no_show','cancelled')),
  unique (session_id, person_id)
);
create index on dropin_attendance (person_id);

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null, subject text not null, body_text text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  created_at timestamptz not null default now(), sent_at timestamptz
);
create table jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null, payload jsonb not null default '{}',
  run_at timestamptz not null default now(), attempts int not null default 0,
  state text not null default 'queued' check (state in ('queued','running','done','dead')),
  last_error text
);
create index on jobs (state, run_at);
create table rate_limits (key text primary key, hits int not null, window_start timestamptz not null);
create table audit_log (
  id bigserial primary key, org_id uuid references organizations(id) on delete set null,
  actor_id uuid references users(id) on delete set null, action text not null,
  target text not null, at timestamptz not null default now()
);
create index on audit_log (org_id, at);
