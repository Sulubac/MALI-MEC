// Client minimal de l'API Google : OAuth 2.0 (code + PKCE), lecture des plages occupées (freeBusy),
// écriture et suppression d'événements. API officielles, avec les identifiants du propriétaire.
import { createHash, randomBytes } from "node:crypto";
import { appUrl } from "./email.ts";

export const GOOGLE_OAUTH_COOKIE = "g_oauth";
const CAL = "https://www.googleapis.com/auth/";
// Portées par défaut. `calendar.events` est celle dont le nom est certain ; une portée plus étroite
// (ex. calendar.events.owned) peut la remplacer via GOOGLE_CALENDAR_SCOPES après vérification dans la documentation Google.
export const DEFAULT_CALENDAR_SCOPES = [`${CAL}calendar.freebusy`, `${CAL}calendar.events`];
const BUSY_SCOPES = ["calendar.freebusy", "calendar.events.freebusy", "calendar", "calendar.readonly", "calendar.events", "calendar.events.readonly"].map((s) => CAL + s);
const WRITE_SCOPES = ["calendar.events", "calendar.events.owned", "calendar"].map((s) => CAL + s);

export const canReadBusy = (granted: string[]) => granted.some((s) => BUSY_SCOPES.includes(s));
export const canWriteEvents = (granted: string[]) => granted.some((s) => WRITE_SCOPES.includes(s));

export type GoogleConfig = {
  clientId: string; clientSecret: string; redirectUri: string; scopes: string[];
  authUrl: string; tokenUrl: string; revokeUrl: string; apiBase: string;
};

/** null tant que GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et TOKEN_ENCRYPTION_KEY ne sont pas tous définis. */
export function googleConfig(env = process.env): GoogleConfig | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.TOKEN_ENCRYPTION_KEY) return null;
  const cal = env.GOOGLE_CALENDAR_SCOPES?.split(/\s+/).filter(Boolean) ?? DEFAULT_CALENDAR_SCOPES;
  return {
    clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI || appUrl("/api/google/callback"),
    scopes: ["openid", "email", ...cal],
    // Les adresses ci-dessous ne sont redéfinies que par les tests (faux serveur Google).
    authUrl: env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token",
    revokeUrl: env.GOOGLE_REVOKE_URL || "https://oauth2.googleapis.com/revoke",
    apiBase: (env.GOOGLE_API_BASE || "https://www.googleapis.com/calendar/v3").replace(/\/+$/, ""),
  };
}

export type GoogleErrorKind =
  | "invalid_grant"   // jeton révoqué ou expiré : il faut que l'utilisateur se reconnecte
  | "unauthorized"    // 401 avec un jeton d'accès : à rafraîchir
  | "forbidden"       // 403 : portée ou API refusée
  | "temporary"       // 429, 5xx, délai dépassé, réseau : réessayer plus tard
  | "bad_request";

export class GoogleError extends Error {
  kind: GoogleErrorKind;
  status?: number;
  constructor(kind: GoogleErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

const TIMEOUT_MS = 6000;

async function call(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new GoogleError("temporary", `réseau : ${e instanceof Error ? e.message : String(e)}`);
  }
}

function classify(status: number, body: string): GoogleError {
  const msg = `Google ${status} : ${body.slice(0, 200)}`;
  if (status === 401) return new GoogleError("unauthorized", msg, status);
  if (status === 403 || status === 404) return new GoogleError(status === 403 ? "forbidden" : "bad_request", msg, status);
  if (status === 429 || status >= 500) return new GoogleError("temporary", msg, status);
  return new GoogleError("bad_request", msg, status);
}

// ---------- OAuth ----------
export function newOAuthState() {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { state, verifier, challenge };
}

export function authorizationUrl(cfg: GoogleConfig, p: { state: string; challenge: string; loginHint?: string }): string {
  const u = new URL(cfg.authUrl);
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", cfg.scopes.join(" "));
  u.searchParams.set("state", p.state);
  u.searchParams.set("code_challenge", p.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("access_type", "offline");   // pour obtenir un jeton de rafraîchissement
  u.searchParams.set("prompt", "consent");        // et le recevoir à chaque connexion
  if (p.loginHint) u.searchParams.set("login_hint", p.loginHint);
  return u.toString();
}

export type TokenSet = { accessToken: string; expiresInSec: number; refreshToken?: string; scopes: string[]; email?: string; idToken?: string };

async function tokenRequest(cfg: GoogleConfig, params: Record<string, string>, timeoutMs = TIMEOUT_MS): Promise<TokenSet> {
  const res = await call(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...params }),
  }, timeoutMs);
  const text = await res.text();
  if (!res.ok) {
    let code = "";
    try { code = JSON.parse(text).error; } catch { /* corps non JSON */ }
    if (code === "invalid_grant") throw new GoogleError("invalid_grant", `Google : ${text.slice(0, 200)}`, res.status);
    // Sur ce point d'accès, un 401 (invalid_client) est une erreur de configuration, pas un jeton d'accès à rafraîchir.
    if (res.status === 429 || res.status >= 500) throw classify(res.status, text);
    throw new GoogleError("bad_request", `Google ${res.status} : ${text.slice(0, 200)}`, res.status);
  }
  const j = JSON.parse(text) as { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string };
  return {
    accessToken: j.access_token, expiresInSec: j.expires_in, refreshToken: j.refresh_token,
    scopes: (j.scope ?? "").split(/\s+/).filter(Boolean), email: j.id_token ? emailFromIdToken(j.id_token) : undefined, idToken: j.id_token,
  };
}

// ---------- Connexion par Google (OpenID Connect) ----------
/** La connexion ne demande que l'identité : l'accès à l'agenda reste un consentement séparé, demandé à part. */
export const SIGNIN_SCOPES = ["openid", "email", "profile"];

export function signInUrl(cfg: GoogleConfig, p: { state: string; challenge: string; nonce: string }): string {
  const u = new URL(cfg.authUrl);
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SIGNIN_SCOPES.join(" "));
  u.searchParams.set("state", p.state);
  u.searchParams.set("nonce", p.nonce);                  // lié à la session du navigateur : empêche le rejeu d'un jeton d'identité
  u.searchParams.set("code_challenge", p.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("prompt", "select_account");        // laisse choisir le compte Google ; pas d'accès hors ligne
  return u.toString();
}

export type IdClaims = { sub: string; email: string; name: string };
export type IdTokenCheck =
  | { ok: true; claims: IdClaims }
  | { ok: false; reason: "invalid" | "issuer" | "audience" | "expired" | "nonce" | "email_unverified" | "no_identity" };

/** Nom affichable : sans caractères de contrôle, espaces réduits, 80 caractères au plus ; à défaut, la partie locale de l'adresse. */
export function cleanName(name: string | undefined, email: string): string {
  const n = (name ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return n || email.split("@")[0].slice(0, 80);
}

/**
 * Vérifie les revendications du jeton d'identité reçu directement du point d'accès de Google en HTTPS avec le secret du client
 * (Google précise que la signature n'a alors pas à être revérifiée) : émetteur, destinataire, expiration, nonce, adresse vérifiée.
 */
export function checkIdToken(idToken: string | undefined, expect: { clientId: string; nonce: string; nowMs?: number }): IdTokenCheck {
  let c: Record<string, unknown>;
  try {
    const part = idToken?.split(".")[1];
    if (!part) return { ok: false, reason: "invalid" };
    c = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch { return { ok: false, reason: "invalid" }; }
  if (!c || typeof c !== "object") return { ok: false, reason: "invalid" };
  if (c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") return { ok: false, reason: "issuer" };
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(expect.clientId)) return { ok: false, reason: "audience" };
  if (typeof c.exp !== "number" || c.exp * 1000 < (expect.nowMs ?? Date.now()) - 60_000) return { ok: false, reason: "expired" };
  if (typeof c.nonce !== "string" || c.nonce !== expect.nonce) return { ok: false, reason: "nonce" };
  if (typeof c.sub !== "string" || !c.sub || c.sub.length > 255 || typeof c.email !== "string" || !c.email.includes("@")) return { ok: false, reason: "no_identity" };
  if (c.email_verified !== true && c.email_verified !== "true") return { ok: false, reason: "email_unverified" };
  const email = c.email.trim().toLowerCase();
  return { ok: true, claims: { sub: c.sub, email, name: cleanName(typeof c.name === "string" ? c.name : undefined, email) } };
}

/** Le jeton d'identité vient directement du point d'accès de Google en HTTPS : on lit ses revendications sans revérifier la signature. */
export function emailFromIdToken(idToken: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : undefined;
  } catch { return undefined; }
}

export const exchangeCode = (cfg: GoogleConfig, code: string, verifier: string) =>
  tokenRequest(cfg, { grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri, code_verifier: verifier });

export const refreshAccessToken = (cfg: GoogleConfig, refreshToken: string, timeoutMs = TIMEOUT_MS) =>
  tokenRequest(cfg, { grant_type: "refresh_token", refresh_token: refreshToken }, timeoutMs);

/** Meilleur effort : l'utilisateur déconnecte son agenda, on le dit à Google, mais un échec n'empêche pas la déconnexion locale. */
export async function revokeToken(cfg: GoogleConfig, token: string): Promise<boolean> {
  try {
    const res = await call(cfg.revokeUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
    return res.ok;
  } catch { return false; }
}

// ---------- Calendar ----------
export type BusyInterval = { start: number; end: number };

/** Délai court pour l'affichage de la page publique (un agenda lent ne doit pas faire attendre l'invité), plus long à la réservation. */
export const DISPLAY_TIMEOUT_MS = 2500;

export async function freeBusy(cfg: GoogleConfig, accessToken: string, fromMs: number, toMs: number, timeoutMs = TIMEOUT_MS): Promise<BusyInterval[]> {
  const res = await call(`${cfg.apiBase}/freeBusy`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ timeMin: new Date(fromMs).toISOString(), timeMax: new Date(toMs).toISOString(), items: [{ id: "primary" }] }),
  }, timeoutMs);
  const text = await res.text();
  if (!res.ok) throw classify(res.status, text);
  const j = JSON.parse(text) as { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }> };
  const cal = j.calendars?.primary;
  if (!cal || cal.errors?.length) throw new GoogleError("temporary", `freeBusy : ${JSON.stringify(cal?.errors ?? "calendrier absent")}`);
  return (cal.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}

export type NewEvent = { id: string; summary: string; description: string; location: string; startIso: string; endIso: string; timeZone: string };

/** L'identifiant de l'événement est choisi par nous (dérivé de la réservation) : rejouer l'insertion ne crée pas de doublon. */
export async function insertEvent(cfg: GoogleConfig, accessToken: string, e: NewEvent): Promise<"created" | "exists"> {
  const res = await call(`${cfg.apiBase}/calendars/primary/events?sendUpdates=none`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      id: e.id, summary: e.summary, description: e.description, ...(e.location ? { location: e.location } : {}),
      start: { dateTime: e.startIso, timeZone: e.timeZone }, end: { dateTime: e.endIso, timeZone: e.timeZone },
    }),
  });
  if (res.status === 409) return "exists";
  const text = await res.text();
  if (!res.ok) throw classify(res.status, text);
  return "created";
}

export async function deleteEvent(cfg: GoogleConfig, accessToken: string, id: string): Promise<"deleted" | "gone"> {
  const res = await call(`${cfg.apiBase}/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=none`, {
    method: "DELETE", headers: { authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404 || res.status === 410) return "gone";
  if (!res.ok) throw classify(res.status, await res.text());
  return "deleted";
}

/** Identifiant d'événement Google : 5 à 1024 caractères parmi a-v et 0-9. Un UUID sans tirets (hexadécimal) convient. */
export const eventIdFor = (bookingId: string) => bookingId.replace(/-/g, "").toLowerCase();
