import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { FAKE, startFakeGoogle } from "../e2e/fake-google.ts";
import {
  authorizationUrl, checkIdToken, cleanName, signInUrl, SIGNIN_SCOPES, canReadBusy, canWriteEvents, deleteEvent, eventIdFor, exchangeCode, freeBusy, GoogleError, googleConfig,
  insertEvent, newOAuthState, refreshAccessToken, revokeToken, type GoogleConfig,
} from "./google.ts";

const PORT = 3291;
const BASE = `http://127.0.0.1:${PORT}`;
let fake: Awaited<ReturnType<typeof startFakeGoogle>>;
const control = (path: string, body: unknown = {}) => fetch(BASE + "/__control/" + path, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());
const state = (): Promise<{ events: { id: string; summary: string }[]; deleted: string[]; refreshTokens: { revoked: boolean }[] }> => fetch(BASE + "/__control/state").then((r) => r.json());

const env = {
  GOOGLE_CLIENT_ID: FAKE.clientId, GOOGLE_CLIENT_SECRET: FAKE.clientSecret, TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  GOOGLE_REDIRECT_URI: "http://app.test/api/google/callback", GOOGLE_AUTH_URL: `${BASE}/auth`, GOOGLE_TOKEN_URL: `${BASE}/token`,
  GOOGLE_REVOKE_URL: `${BASE}/revoke`, GOOGLE_API_BASE: `${BASE}/calendar/v3`,
} as unknown as NodeJS.ProcessEnv;
const cfg = googleConfig(env) as GoogleConfig;

/** Joue la page de consentement : suit /auth et lit le code dans la redirection. */
async function consent() {
  const s = newOAuthState();
  const res = await fetch(authorizationUrl(cfg, { state: s.state, challenge: s.challenge }), { redirect: "manual" });
  const loc = new URL(res.headers.get("location")!);
  return { s, loc, code: loc.searchParams.get("code")! };
}
const sampleEvent = (id = eventIdFor("123e4567-e89b-12d3-a456-426614174000")) => ({ id, summary: "RDV : Camille", description: "d", location: "Salle 3", startIso: "2030-05-06T08:00:00.000Z", endIso: "2030-05-06T08:30:00.000Z", timeZone: "Europe/Paris" });

before(async () => { fake = await startFakeGoogle(PORT); });
after(async () => { await fake.close(); });
beforeEach(async () => { await control("reset"); });

test("configuration : absente sans identifiants ; portées par défaut et redéfinies", () => {
  assert.equal(googleConfig({} as NodeJS.ProcessEnv), null);
  assert.equal(googleConfig({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" } as unknown as NodeJS.ProcessEnv), null, "sans clé de chiffrement");
  assert.deepEqual(cfg.scopes.slice(0, 2), ["openid", "email"]);
  assert.ok(cfg.scopes.includes("https://www.googleapis.com/auth/calendar.freebusy"));
  const narrow = googleConfig({ ...env, GOOGLE_CALENDAR_SCOPES: "https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events.owned" } as unknown as NodeJS.ProcessEnv)!;
  assert.ok(narrow.scopes.includes("https://www.googleapis.com/auth/calendar.events.owned") && !narrow.scopes.includes("https://www.googleapis.com/auth/calendar.events"));
});

test("adresse d'autorisation : PKCE S256, accès hors ligne, consentement, état", () => {
  const u = new URL(authorizationUrl(cfg, { state: "S", challenge: "C" }));
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("code_challenge"), "C");
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("prompt"), "consent");
  assert.equal(u.searchParams.get("state"), "S");
  assert.equal(u.searchParams.get("redirect_uri"), "http://app.test/api/google/callback");
  assert.match(u.searchParams.get("scope")!, /openid email .*calendar\.freebusy .*calendar\.events/);
});

test("parcours OAuth : code → jetons, adresse du compte, portées, jeton de rafraîchissement", async () => {
  const { s, loc, code } = await consent();
  assert.equal(loc.searchParams.get("state"), s.state);
  const t = await exchangeCode(cfg, code, s.verifier);
  assert.equal(t.email, "host@gmail.test");
  assert.ok(t.refreshToken?.startsWith("1//"));
  assert.ok(canReadBusy(t.scopes) && canWriteEvents(t.scopes));
});

test("vérificateur PKCE incorrect et code rejoué : invalid_grant", async () => {
  const a = await consent();
  await assert.rejects(exchangeCode(cfg, a.code, "mauvais-verificateur"), (e: GoogleError) => e.kind === "invalid_grant");
  const b = await consent();
  await exchangeCode(cfg, b.code, b.s.verifier);
  await assert.rejects(exchangeCode(cfg, b.code, b.s.verifier), (e: GoogleError) => e.kind === "invalid_grant");
});

test("mauvais secret client : erreur, pas d'invalid_grant", async () => {
  const { s, code } = await consent();
  await assert.rejects(exchangeCode({ ...cfg, clientSecret: "faux" }, code, s.verifier), (e: GoogleError) => e.kind === "bad_request" && e.status === 401);
});

test("consentement partiel : les portées refusées sont absentes de la réponse", async () => {
  await control("options", { deniedScopes: ["https://www.googleapis.com/auth/calendar.events"] });
  const { s, code } = await consent();
  const t = await exchangeCode(cfg, code, s.verifier);
  assert.ok(canReadBusy(t.scopes));
  assert.ok(!canWriteEvents(t.scopes));
});

test("rafraîchissement : nouveau jeton d'accès ; jeton révoqué = invalid_grant", async () => {
  const { s, code } = await consent();
  const t = await exchangeCode(cfg, code, s.verifier);
  const r = await refreshAccessToken(cfg, t.refreshToken!);
  assert.ok(r.accessToken && r.accessToken !== t.accessToken);
  await control("revoke-all", { email: "host@gmail.test" });
  await assert.rejects(refreshAccessToken(cfg, t.refreshToken!), (e: GoogleError) => e.kind === "invalid_grant");
});

test("révocation volontaire : le jeton ne sert plus", async () => {
  const { s, code } = await consent();
  const t = await exchangeCode(cfg, code, s.verifier);
  assert.equal(await revokeToken(cfg, t.refreshToken!), true);
  assert.equal((await state()).refreshTokens[0].revoked, true);
  await assert.rejects(refreshAccessToken(cfg, t.refreshToken!), (e: GoogleError) => e.kind === "invalid_grant");
});

test("freeBusy : plages occupées et événements créés, bornées à la fenêtre demandée", async () => {
  const { s, code } = await consent();
  const t = await exchangeCode(cfg, code, s.verifier);
  await control("busy", { email: "host@gmail.test", start: "2030-05-06T10:00:00Z", end: "2030-05-06T11:00:00Z" });
  await control("busy", { email: "host@gmail.test", start: "2031-01-01T10:00:00Z", end: "2031-01-01T11:00:00Z" }); // hors fenêtre
  await insertEvent(cfg, t.accessToken, sampleEvent());
  const busy = await freeBusy(cfg, t.accessToken, Date.parse("2030-05-06T00:00:00Z"), Date.parse("2030-05-07T00:00:00Z"));
  assert.deepEqual(busy.map((b) => [new Date(b.start).toISOString(), new Date(b.end).toISOString()]).sort(),
    [["2030-05-06T08:00:00.000Z", "2030-05-06T08:30:00.000Z"], ["2030-05-06T10:00:00.000Z", "2030-05-06T11:00:00.000Z"]]);
});

test("insertion d'événement : créé, rejouée = « exists », identifiant invalide refusé", async () => {
  const { s, code } = await consent();
  const t = await exchangeCode(cfg, code, s.verifier);
  assert.equal(await insertEvent(cfg, t.accessToken, sampleEvent()), "created");
  assert.equal(await insertEvent(cfg, t.accessToken, sampleEvent()), "exists");
  assert.equal((await state()).events.length, 1);
  await assert.rejects(insertEvent(cfg, t.accessToken, sampleEvent("MAJUSCULES-ET-TIRETS")), (e: GoogleError) => e.kind === "bad_request");
  assert.match(eventIdFor("123E4567-e89b-12d3-a456-426614174000"), /^[a-v0-9]{5,1024}$/);
});

test("suppression : supprimé, puis « gone » si déjà supprimé ou inexistant", async () => {
  const { s, code } = await consent();
  const t = await exchangeCode(cfg, code, s.verifier);
  await insertEvent(cfg, t.accessToken, sampleEvent());
  assert.equal(await deleteEvent(cfg, t.accessToken, sampleEvent().id), "deleted");
  assert.equal(await deleteEvent(cfg, t.accessToken, sampleEvent().id), "gone");
  assert.equal(await deleteEvent(cfg, t.accessToken, "abcde12345"), "gone");
});

test("erreurs classées : 401 = unauthorized, 500/429 = temporary, serveur absent = temporary", async () => {
  const { s, code } = await consent();
  const t = await exchangeCode(cfg, code, s.verifier);
  await control("expire-access");
  await assert.rejects(freeBusy(cfg, t.accessToken, 0, 1), (e: GoogleError) => e.kind === "unauthorized");
  const fresh = (await refreshAccessToken(cfg, t.refreshToken!)).accessToken;
  await control("fail", { target: "freebusy", status: 500, times: 1 });
  await assert.rejects(freeBusy(cfg, fresh, 0, 1), (e: GoogleError) => e.kind === "temporary");
  await control("fail", { target: "events", status: 429, times: 1 });
  await assert.rejects(insertEvent(cfg, fresh, sampleEvent()), (e: GoogleError) => e.kind === "temporary");
  const down = { ...cfg, apiBase: "http://127.0.0.1:9/calendar/v3" };
  await assert.rejects(freeBusy(down, fresh, 0, 1), (e: GoogleError) => e.kind === "temporary");
});

test("aides de portée", () => {
  const P = "https://www.googleapis.com/auth/";
  assert.ok(canReadBusy([P + "calendar.freebusy"]) && !canWriteEvents([P + "calendar.freebusy"]));
  assert.ok(canWriteEvents([P + "calendar.events.owned"]));
  assert.ok(!canReadBusy(["openid", "email"]));
});

// ===== Connexion par Google : jeton d'identité =====
const NOW = Date.UTC(2030, 0, 1, 12, 0, 0);
const idTok = (over: Record<string, unknown> = {}) => ["h", Buffer.from(JSON.stringify({
  iss: "https://accounts.google.com", aud: FAKE.clientId, sub: "sub-1", email: "Alex@Example.com", email_verified: true, name: "Alex Martin",
  nonce: "N1", exp: Math.floor(NOW / 1000) + 3600, ...over,
})).toString("base64url"), "s"].join(".");
const check = (over: Record<string, unknown> = {}, nonce = "N1") => checkIdToken(idTok(over), { clientId: FAKE.clientId, nonce, nowMs: NOW });

test("adresse de connexion : identité seulement, nonce, PKCE, choix du compte, pas d'accès hors ligne", () => {
  const u = new URL(signInUrl(cfg, { state: "S", challenge: "C", nonce: "N" }));
  assert.equal(u.searchParams.get("scope"), SIGNIN_SCOPES.join(" "));
  assert.ok(!/calendar/.test(u.searchParams.get("scope")!), "aucune portée d'agenda pour une simple connexion");
  assert.equal(u.searchParams.get("nonce"), "N");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("prompt"), "select_account");
  assert.equal(u.searchParams.get("access_type"), null);
});

test("jeton d'identité valide : revendications normalisées (adresse en minuscules)", () => {
  const r = check();
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.claims, { sub: "sub-1", email: "alex@example.com", name: "Alex Martin" });
});

test("jeton d'identité : émetteur, destinataire, expiration, nonce, adresse non vérifiée, identité absente", () => {
  assert.deepEqual(check({ iss: "accounts.google.com" }).ok, true);
  assert.equal((check({ iss: "https://evil.example" }) as { reason: string }).reason, "issuer");
  assert.equal((check({ aud: "autre-client" }) as { reason: string }).reason, "audience");
  assert.equal(check({ aud: ["x", FAKE.clientId] }).ok, true);
  assert.equal((check({ exp: Math.floor(NOW / 1000) - 3600 }) as { reason: string }).reason, "expired");
  assert.equal(check({ exp: Math.floor(NOW / 1000) - 30 }).ok, true, "marge d'une minute pour l'horloge");
  assert.equal((check({}, "AUTRE") as { reason: string }).reason, "nonce");
  assert.equal((check({ nonce: undefined }) as { reason: string }).reason, "nonce");
  assert.equal((check({ email_verified: false }) as { reason: string }).reason, "email_unverified");
  assert.equal((check({ email_verified: undefined }) as { reason: string }).reason, "email_unverified");
  assert.equal(check({ email_verified: "true" }).ok, true, "Google renvoie parfois la chaîne « true »");
  assert.equal((check({ sub: "" }) as { reason: string }).reason, "no_identity");
  assert.equal((check({ sub: "x".repeat(300) }) as { reason: string }).reason, "no_identity");
  assert.equal((check({ email: "pas-une-adresse" }) as { reason: string }).reason, "no_identity");
});

test("jeton d'identité mal formé : refusé sans exception", () => {
  for (const bad of [undefined, "", "abc", "a.b.c", "a..c", `a.${Buffer.from("[]").toString("base64url")}.c`, `a.${Buffer.from("null").toString("base64url")}.c`]) {
    assert.equal(checkIdToken(bad, { clientId: FAKE.clientId, nonce: "N1", nowMs: NOW }).ok, false, `refus attendu pour ${String(bad)}`);
  }
});

test("nom affiché : caractères de contrôle retirés, 80 caractères, repli sur la partie locale de l'adresse", () => {
  assert.equal(cleanName("  Alex \n\t Martin\u0000 ", "a@b.c"), "Alex Martin");
  assert.equal(cleanName("x".repeat(200), "a@b.c").length, 80);
  assert.equal(cleanName("   ", "alex.martin@example.com"), "alex.martin");
  assert.equal(cleanName(undefined, "zoe@example.com"), "zoe");
});

