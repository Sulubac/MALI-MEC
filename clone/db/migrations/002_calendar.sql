-- Connexion d'un agenda externe (Google). Le jeton de rafraîchissement est chiffré par l'application
-- (AES-256-GCM, lié à l'identifiant de l'utilisateur) : la base ne contient jamais de jeton en clair.
create table calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null check (provider in ('google')),
  external_account text not null,           -- adresse du compte Google, affichée à l'utilisateur
  refresh_token_enc text not null,
  scopes text not null,                     -- portées réellement accordées (l'utilisateur peut en refuser)
  check_busy boolean not null default true,     -- ne pas proposer les créneaux déjà occupés dans l'agenda
  write_bookings boolean not null default true, -- ajouter les réservations à l'agenda
  status text not null default 'active' check (status in ('active','revoked')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
create trigger t_calendar_connections before update on calendar_connections for each row execute function set_updated_at();
