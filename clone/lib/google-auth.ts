// Connexion par Google : identités liées aux comptes. Aucune dépendance à Next : testable seul.
//
// Règles de sécurité (voir replica/backend.md) :
//  - l'identité d'un utilisateur chez Google est son « sub », jamais son adresse e-mail seule ;
//  - on ne lie JAMAIS Google à un compte existant par simple égalité d'adresse e-mail : un compte local vérifié exige le mot
//    de passe puis une liaison explicite ; un compte local non vérifié (pré-détournement) est supprimé, pas repris.
import { randomBytes } from "node:crypto";
import { hashPassword } from "./auth-core.ts";
import { decryptSecret, encryptSecret } from "./crypto.ts";
import { isUniqueViolation, query, tx } from "./db.ts";
import type { IdClaims } from "./google.ts";
import { suggestUsername } from "./validate.ts";

export const GOOGLE_SIGNUP_COOKIE = "g_signup";
const PENDING_TTL_MS = 15 * 60_000;

export type GoogleLogin =
  | { status: "ok"; userId: string }
  | { status: "new"; replacedUnverified: boolean }
  | { status: "email_in_use" };

const randomPasswordHash = () => hashPassword(randomBytes(32).toString("base64"));

export async function resolveGoogleLogin(c: IdClaims): Promise<GoogleLogin> {
  const known = await query<{ user_id: string }>("select user_id from user_identities where provider = 'google' and provider_subject = $1", [c.sub]);
  if (known[0]) return { status: "ok", userId: known[0].user_id };

  const local = await query<{ id: string; email_verified_at: Date | null }>("select id, email_verified_at from users where lower(email) = $1", [c.email]);
  if (!local[0]) return { status: "new", replacedUnverified: false };
  if (local[0].email_verified_at) return { status: "email_in_use" };

  // Compte local jamais vérifié avec cette adresse : quelqu'un a pu l'ouvrir en sachant l'adresse d'autrui pour y garder un mot de passe
  // connu (« pré-détournement »). Il ne peut avoir aucune donnée (connexion impossible sans vérification) : on le supprime entièrement,
  // et la personne qui contrôle réellement l'adresse repart d'un compte vierge.
  await query("delete from users where id = $1 and email_verified_at is null", [local[0].id]);
  return { status: "new", replacedUnverified: true };
}

/** Suggestion libre de nom pour le lien public : essaie le nom de base puis ajoute -2, -3… */
export async function availableUsername(email: string, name?: string): Promise<string> {
  const base = suggestUsername(email, name);
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 36)}-${n}`;
    if (!(await query("select 1 from profiles where username = $1", [candidate])).length) return candidate;
  }
  return `${base.slice(0, 30)}-${randomBytes(3).toString("hex")}`;
}

export type CompleteResult = { status: "created"; userId: string } | { status: "exists"; userId: string } | { status: "username_taken" } | { status: "email_in_use" };

/** Crée le compte une fois le profil choisi. Revérifie tout : entre le retour de Google et cette étape, un compte a pu apparaître. */
export async function completeGoogleSignup(c: IdClaims, p: { username: string; displayName: string; timezone: string }): Promise<CompleteResult> {
  const passwordHash = await randomPasswordHash();
  try {
    return await tx(async (conn): Promise<CompleteResult> => {
      const known = await conn.query<{ user_id: string }>("select user_id from user_identities where provider = 'google' and provider_subject = $1", [c.sub]);
      if (known.rows[0]) return { status: "exists", userId: known.rows[0].user_id };
      if ((await conn.query("select 1 from users where lower(email) = $1", [c.email])).rowCount) return { status: "email_in_use" };
      const u = await conn.query<{ id: string }>(
        "insert into users (email, password_hash, password_set, email_verified_at) values ($1, $2, false, now()) returning id", [c.email, passwordHash]);
      const id = u.rows[0].id;
      await conn.query("insert into profiles (id, username, display_name, timezone) values ($1,$2,$3,$4)", [id, p.username, p.displayName, p.timezone]);
      for (let wd = 1; wd <= 5; wd++) await conn.query("insert into availability_rules (user_id, weekday, start_time, end_time) values ($1,$2,'09:00','17:00')", [id, wd]);
      await conn.query("insert into user_identities (user_id, provider, provider_subject, email) values ($1,'google',$2,$3)", [id, c.sub, c.email]);
      return { status: "created", userId: id };
    });
  } catch (e) {
    if (isUniqueViolation(e, "profiles_username_key")) return { status: "username_taken" };
    if (isUniqueViolation(e, "users_email_lower_key")) return { status: "email_in_use" };
    if (isUniqueViolation(e, "user_identities_provider_provider_subject_key")) {
      const k = await query<{ user_id: string }>("select user_id from user_identities where provider = 'google' and provider_subject = $1", [c.sub]);
      if (k[0]) return { status: "exists", userId: k[0].user_id };
    }
    throw e;
  }
}

export type LinkResult = "linked" | "already_linked" | "taken" | "has_other";

/** Lie un compte Google à l'utilisateur connecté. Refuse si ce compte Google appartient déjà à quelqu'un d'autre. */
export async function linkGoogle(userId: string, c: IdClaims): Promise<LinkResult> {
  const bySub = await query<{ user_id: string }>("select user_id from user_identities where provider = 'google' and provider_subject = $1", [c.sub]);
  if (bySub[0]) return bySub[0].user_id === userId ? "already_linked" : "taken";
  if ((await query("select 1 from user_identities where user_id = $1 and provider = 'google'", [userId])).length) return "has_other";
  try {
    await query("insert into user_identities (user_id, provider, provider_subject, email) values ($1,'google',$2,$3)", [userId, c.sub, c.email]);
    return "linked";
  } catch (e) {
    if (isUniqueViolation(e)) return "taken";
    throw e;
  }
}

/** Délie Google. Refusé si c'est le seul moyen de se connecter (pas de mot de passe défini) : l'utilisateur serait verrouillé dehors. */
export async function unlinkGoogle(userId: string): Promise<"unlinked" | "not_linked" | "needs_password"> {
  const u = await query<{ password_set: boolean }>("select password_set from users where id = $1", [userId]);
  if (!u[0]) return "not_linked";
  if (!(await query("select 1 from user_identities where user_id = $1 and provider = 'google'", [userId])).length) return "not_linked";
  if (!u[0].password_set) return "needs_password";
  await query("delete from user_identities where user_id = $1 and provider = 'google'", [userId]);
  return "unlinked";
}

export async function getGoogleIdentity(userId: string): Promise<{ email: string } | null> {
  const r = await query<{ email: string }>("select email from user_identities where user_id = $1 and provider = 'google'", [userId]);
  return r[0] ?? null;
}

// ---------- état « inscription en cours » entre le retour de Google et le choix du profil ----------
/** Identité Google vérifiée, scellée (chiffrée et liée au nom du cookie) pour 15 minutes : le navigateur ne peut ni la lire ni la modifier. */
export function sealPending(c: IdClaims, nowMs = Date.now()): string {
  return encryptSecret(JSON.stringify({ ...c, exp: nowMs + PENDING_TTL_MS }), GOOGLE_SIGNUP_COOKIE);
}

export function openPending(value: string | undefined, nowMs = Date.now()): IdClaims | null {
  if (!value) return null;
  try {
    const j = JSON.parse(decryptSecret(value, GOOGLE_SIGNUP_COOKIE)) as IdClaims & { exp: number };
    if (typeof j.exp !== "number" || j.exp < nowMs || !j.sub || !j.email) return null;
    return { sub: j.sub, email: j.email, name: j.name };
  } catch { return null; }
}
