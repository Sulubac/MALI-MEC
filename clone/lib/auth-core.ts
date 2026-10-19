// Comptes, mots de passe, sessions et jetons d'e-mail. Aucune dépendance à Next : testable seul.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { isUniqueViolation, query, tx } from "./db.ts";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

const N = 16384, R = 8, P = 1, KEYLEN = 64;
const SESSION_DAYS = 30;
export const VERIFY_TTL_HOURS = 24;
export const RESET_TTL_MINUTES = 60;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length, { N: +n, r: +r, p: +p, maxmem: 64 * 1024 * 1024 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Empreinte factice : un e-mail inconnu coûte le même temps de calcul qu'un mot de passe faux.
let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= hashPassword("mot-de-passe-factice-jamais-valide"));

export type AuthUser = {
  id: string; email: string; emailVerified: boolean;
  hasPassword: boolean;   // false pour un compte créé avec Google (mot de passe aléatoire que personne ne connaît)
  sessionAgeSec: number;  // ancienneté de la session : sert à exiger une connexion récente pour les actions sensibles
};

type SignUpInput = { email: string; password: string; username: string; displayName: string; timezone: string };
export type SignUpResult =
  | { status: "created"; userId: string; token: string }
  | { status: "email_exists"; userId: string }
  | { status: "username_taken" };

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const email = input.email.trim().toLowerCase();
  // L'empreinte est calculée dans tous les cas : sinon une adresse déjà inscrite répondrait visiblement plus vite.
  const passwordHash = await hashPassword(input.password);
  const existing = await query<{ id: string }>("select id from users where lower(email) = $1", [email]);
  if (existing[0]) return { status: "email_exists", userId: existing[0].id };
  try {
    return await tx(async (c) => {
      const u = await c.query<{ id: string }>("insert into users (email, password_hash) values ($1, $2) returning id", [email, passwordHash]);
      const id = u.rows[0].id;
      await c.query("insert into profiles (id, username, display_name, timezone) values ($1,$2,$3,$4)", [id, input.username, input.displayName, input.timezone]);
      for (let wd = 1; wd <= 5; wd++) await c.query("insert into availability_rules (user_id, weekday, start_time, end_time) values ($1,$2,'09:00','17:00')", [id, wd]);
      const token = await createEmailTokenIn(c, id, "verify_email", VERIFY_TTL_HOURS * 60);
      return { status: "created" as const, userId: id, token };
    });
  } catch (e) {
    if (isUniqueViolation(e, "profiles_username_key")) return { status: "username_taken" };
    if (isUniqueViolation(e, "users_email_lower_key")) {
      const again = await query<{ id: string }>("select id from users where lower(email) = $1", [email]);
      return { status: "email_exists", userId: again[0].id };
    }
    throw e;
  }
}

type Tx = Parameters<Parameters<typeof tx>[0]>[0];

async function createEmailTokenIn(c: Tx, userId: string, purpose: "verify_email" | "reset_password", ttlMinutes: number): Promise<string> {
  await c.query("update email_tokens set used_at = now() where user_id = $1 and purpose = $2 and used_at is null", [userId, purpose]); // un seul lien valide à la fois
  const token = newToken();
  await c.query("insert into email_tokens (user_id, purpose, token_hash, expires_at) values ($1,$2,$3, now() + make_interval(mins => $4))", [userId, purpose, sha256(token), ttlMinutes]);
  return token;
}

/** Nouveau lien de vérification pour une adresse non vérifiée ; null sinon (même réponse côté appelant). */
export async function reissueVerification(email: string): Promise<{ userId: string; token: string } | null> {
  const u = await query<{ id: string; email_verified_at: Date | null }>("select id, email_verified_at from users where lower(email) = $1", [email.trim().toLowerCase()]);
  if (!u[0] || u[0].email_verified_at) return null;
  const token = await tx((c) => createEmailTokenIn(c, u[0].id, "verify_email", VERIFY_TTL_HOURS * 60));
  return { userId: u[0].id, token };
}

export async function verifyEmail(token: string): Promise<boolean> {
  return tx(async (c) => {
    const t = await c.query<{ id: string; user_id: string }>(
      "select id, user_id from email_tokens where token_hash = $1 and purpose = 'verify_email' and used_at is null and expires_at > now() for update", [sha256(token)]);
    if (!t.rows[0]) return false;
    await c.query("update email_tokens set used_at = now() where id = $1", [t.rows[0].id]);
    await c.query("update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1", [t.rows[0].user_id]);
    return true;
  });
}

export type LoginResult = { status: "ok"; user: AuthUser } | { status: "invalid" } | { status: "unverified" };

export async function checkCredentials(email: string, password: string): Promise<LoginResult> {
  const r = await query<{ id: string; email: string; password_hash: string; email_verified_at: Date | null }>(
    "select id, email, password_hash, email_verified_at from users where lower(email) = $1", [email.trim().toLowerCase()]);
  const u = r[0];
  const ok = await verifyPassword(password, u ? u.password_hash : await dummyHash());
  if (!u || !ok) return { status: "invalid" };
  if (!u.email_verified_at) return { status: "unverified" };
  return { status: "ok", user: { id: u.id, email: u.email, emailVerified: true, hasPassword: true, sessionAgeSec: 0 } };
}

// ---------- Sessions ----------
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600_000);
  await query("insert into sessions (user_id, token_hash, expires_at) values ($1,$2,$3)", [userId, sha256(token), expiresAt]);
  return { token, expiresAt };
}

export async function getSessionUser(token: string): Promise<AuthUser | null> {
  if (!token) return null;
  const r = await query<{ id: string; email: string; email_verified_at: Date | null; sid: string; last_seen_at: Date; created_at: Date; password_set: boolean }>(
    `select u.id, u.email, u.email_verified_at, u.password_set, s.id as sid, s.last_seen_at, s.created_at
     from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`, [sha256(token)]);
  const u = r[0];
  if (!u || !u.email_verified_at) return null;
  if (Date.now() - u.last_seen_at.getTime() > 5 * 60_000) await query("update sessions set last_seen_at = now() where id = $1", [u.sid]);
  return { id: u.id, email: u.email, emailVerified: true, hasPassword: u.password_set, sessionAgeSec: Math.max(0, Math.floor((Date.now() - u.created_at.getTime()) / 1000)) };
}

export async function deleteSession(token: string): Promise<void> {
  await query("delete from sessions where token_hash = $1", [sha256(token)]);
}
export async function deleteAllSessions(userId: string): Promise<void> {
  await query("delete from sessions where user_id = $1", [userId]);
}

// ---------- Mot de passe oublié ----------
export async function requestPasswordReset(email: string): Promise<{ userId: string; token: string } | null> {
  const u = await query<{ id: string }>("select id from users where lower(email) = $1 and email_verified_at is not null", [email.trim().toLowerCase()]);
  if (!u[0]) return null;
  const token = await tx((c) => createEmailTokenIn(c, u[0].id, "reset_password", RESET_TTL_MINUTES));
  return { userId: u[0].id, token };
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const passwordHash = await hashPassword(newPassword);
  return tx(async (c) => {
    const t = await c.query<{ id: string; user_id: string }>(
      "select id, user_id from email_tokens where token_hash = $1 and purpose = 'reset_password' and used_at is null and expires_at > now() for update", [sha256(token)]);
    if (!t.rows[0]) return false;
    await c.query("update email_tokens set used_at = now() where id = $1", [t.rows[0].id]);
    await c.query("update users set password_hash = $2, password_set = true where id = $1", [t.rows[0].user_id, passwordHash]);
    await c.query("delete from sessions where user_id = $1", [t.rows[0].user_id]); // toute session ouverte est coupée
    return true;
  });
}

export async function getEmailTokenStatus(token: string, purpose: "verify_email" | "reset_password"): Promise<boolean> {
  const r = await query("select 1 from email_tokens where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now()", [sha256(token), purpose]);
  return r.length > 0;
}

/** Supprime réellement le compte et tout ce qui en dépend (cascade) après vérification du mot de passe. */
export async function deleteAccount(userId: string, password: string, beforeDelete?: () => Promise<void>): Promise<boolean> {
  const r = await query<{ password_hash: string }>("select password_hash from users where id = $1", [userId]);
  if (!r[0] || !(await verifyPassword(password, r[0].password_hash))) return false;
  if (beforeDelete) await beforeDelete(); // appelé seulement après vérification du mot de passe (ex. révoquer l'accès Google)
  await query("delete from users where id = $1", [userId]);
  return true;
}

/**
 * Suppression d'un compte sans mot de passe (créé avec Google) : l'utilisateur doit retaper son adresse e-mail exacte.
 * L'appelant exige en plus une session récente. Refuse si le compte a un vrai mot de passe (il faut alors l'utiliser).
 */
export async function deleteAccountPasswordless(userId: string, typedEmail: string, beforeDelete?: () => Promise<void>): Promise<boolean> {
  const r = await query<{ email: string; password_set: boolean }>("select email, password_set from users where id = $1", [userId]);
  if (!r[0] || r[0].password_set || r[0].email.toLowerCase() !== typedEmail.trim().toLowerCase()) return false;
  if (beforeDelete) await beforeDelete();
  await query("delete from users where id = $1", [userId]);
  return true;
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const r = await query<{ email: string }>("select email from users where id = $1", [userId]);
  return r[0]?.email ?? null;
}

/** Nettoyage périodique : sessions et jetons expirés, anciennes fenêtres de limite de débit. */
export async function cleanupExpired(): Promise<{ sessions: number; tokens: number; rateLimits: number }> {
  const s = await query("delete from sessions where expires_at < now() returning 1");
  const t = await query("delete from email_tokens where expires_at < now() - interval '7 days' returning 1");
  const l = await query("delete from rate_limits where window_start < now() - interval '1 day' returning 1");
  return { sessions: s.length, tokens: t.length, rateLimits: l.length };
}
