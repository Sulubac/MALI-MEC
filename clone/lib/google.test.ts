import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { FAKE, startFakeGoogle } from "../e2e/fake-google.ts";
import {
  authorizationUrl, canReadBusy, canWriteEvents, deleteEvent, eventIdFor, exchangeCode, freeBusy, GoogleError, googleConfig,
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
