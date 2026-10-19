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

async function call(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
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

export type TokenSet = { accessToken: string; expiresInSec: number; refreshToken?: string; scopes: string[]; email?: string };

async function tokenRequest(cfg: GoogleConfig, params: Record<string, string>): Promise<TokenSet> {
  const res = await call(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...params }),
  });
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
    scopes: (j.scope ?? "").split(/\s+/).filter(Boolean), email: j.id_token ? emailFromIdToken(j.id_token) : undefined,
  };
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

export const refreshAccessToken = (cfg: GoogleConfig, refreshToken: string) =>
  tokenRequest(cfg, { grant_type: "refresh_token", refresh_token: refreshToken });

/** Meilleur effort : l'utilisateur déconnecte son agenda, on le dit à Google, mais un échec n'empêche pas la déconnexion locale. */
export async function revokeToken(cfg: GoogleConfig, token: string): Promise<boolean> {
  try {
    const res = await call(cfg.revokeUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
    return res.ok;
  } catch { return false; }
}

// ---------- Calendar ----------
export type BusyInterval = { start: number; end: number };

export async function freeBusy(cfg: GoogleConfig, accessToken: string, fromMs: number, toMs: number): Promise<BusyInterval[]> {
  const res = await call(`${cfg.apiBase}/freeBusy`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ timeMin: new Date(fromMs).toISOString(), timeMax: new Date(toMs).toISOString(), items: [{ id: "primary" }] }),
  });
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
