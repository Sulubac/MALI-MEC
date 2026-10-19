-- Connexion par Google : identités externes liées à un compte, et indicateur « mot de passe défini ».
-- Un compte créé via Google reçoit un mot de passe aléatoire que personne ne connaît (la colonne reste non nulle) :
-- password_set = false permet de savoir qu'il n'y a pas de vrai mot de passe (suppression du compte, déliaison).
alter table users add column password_set boolean not null default true;

create table user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  provider_subject text not null,           -- identifiant stable chez Google (« sub ») : jamais l'e-mail, qui peut changer ou être recyclé
  email text not null,                       -- adresse Google au moment de la liaison, à titre d'information
  created_at timestamptz not null default now(),
  unique (provider, provider_subject),
  unique (user_id, provider)
);
