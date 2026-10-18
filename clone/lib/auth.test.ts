import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { resetDb, skip } from "./testdb.ts";

const opts = { skip };
let A: typeof import("./auth-core.ts");
let DB: typeof import("./db.ts");
let RL: typeof import("./rate-limit.ts");
const input = { email: "Alice@Example.com", password: "un-mot-de-passe-solide", username: "alice", displayName: "Alice", timezone: "Europe/Paris" };

before(async () => { if (!skip) { DB = await import("./db.ts"); A = await import("./auth-core.ts"); RL = await import("./rate-limit.ts"); } });
after(async () => { if (!skip) await DB.closePool(); });
beforeEach(async () => { if (!skip) await resetDb(); });

test("mot de passe : empreinte salée, vérification, jamais en clair", opts, async () => {
  const h1 = await A.hashPassword("secret-secret"), h2 = await A.hashPassword("secret-secret");
  assert.notEqual(h1, h2);
  assert.ok(await A.verifyPassword("secret-secret", h1));
  assert.ok(!(await A.verifyPassword("secret-secreT", h1)));
  assert.ok(!h1.includes("secret-secret"));
});

test("inscription : refus de connexion tant que l'e-mail n'est pas vérifié", opts, async () => {
  const r = await A.signUp(input);
  assert.equal(r.status, "created");
  assert.deepEqual(await A.checkCredentials("alice@example.com", input.password), { status: "unverified" });
  assert.equal((await A.checkCredentials("alice@example.com", "mauvais-mot-de-passe")).status, "invalid");
  assert.ok(r.status === "created" && (await A.verifyEmail(r.token)));
  const ok = await A.checkCredentials("ALICE@example.com", input.password);
  assert.equal(ok.status, "ok");
});

test("le jeton de vérification ne sert qu'une fois et est stocké haché", opts, async () => {
  const r = await A.signUp(input);
  assert.ok(r.status === "created");
  if (r.status !== "created") return;
  const stored = await DB.query("select token_hash from email_tokens");
  assert.ok(!JSON.stringify(stored).includes(r.token));
  assert.ok(await A.verifyEmail(r.token));
  assert.ok(!(await A.verifyEmail(r.token)));
  assert.ok(!(await A.verifyEmail("n-importe-quoi")));
});

test("jeton expiré refusé", opts, async () => {
  const r = await A.signUp(input);
  if (r.status !== "created") throw new Error("inscription");
  await DB.query("update email_tokens set expires_at = now() - interval '1 minute'");
  assert.ok(!(await A.verifyEmail(r.token)));
});

test("adresse déjà inscrite (casse différente) et nom d'utilisateur pris", opts, async () => {
  await A.signUp(input);
  assert.equal((await A.signUp({ ...input, email: "ALICE@EXAMPLE.COM", username: "autre" })).status, "email_exists");
  assert.equal((await A.signUp({ ...input, email: "b@example.com" })).status, "username_taken");
});

test("sessions : jeton haché en base, expiration, déconnexion partout", opts, async () => {
  const r = await A.signUp(input);
  if (r.status !== "created") throw new Error("inscription");
  await A.verifyEmail(r.token);
  const s1 = await A.createSession(r.userId), s2 = await A.createSession(r.userId);
  assert.equal((await A.getSessionUser(s1.token))?.id, r.userId);
  assert.ok(!JSON.stringify(await DB.query("select token_hash from sessions")).includes(s1.token));
  assert.equal(await A.getSessionUser("faux"), null);
  await A.deleteSession(s1.token);
  assert.equal(await A.getSessionUser(s1.token), null);
  assert.ok(await A.getSessionUser(s2.token));
  await DB.query("update sessions set expires_at = now() - interval '1 second'");
  assert.equal(await A.getSessionUser(s2.token), null);
  const s3 = await A.createSession(r.userId), s4 = await A.createSession(r.userId);
  await A.deleteAllSessions(r.userId);
  assert.equal(await A.getSessionUser(s3.token), null);
  assert.equal(await A.getSessionUser(s4.token), null);
});

test("mot de passe oublié : adresse inconnue = null ; réinitialisation coupe les sessions ; jeton à usage unique", opts, async () => {
  const r = await A.signUp(input);
  if (r.status !== "created") throw new Error("inscription");
  assert.equal(await A.requestPasswordReset("alice@example.com"), null); // non vérifiée
  await A.verifyEmail(r.token);
  assert.equal(await A.requestPasswordReset("inconnu@example.com"), null);
  const s = await A.createSession(r.userId);
  const reset = await A.requestPasswordReset("alice@example.com");
  assert.ok(reset);
  assert.ok(!(await A.resetPassword("faux", "nouveau-mot-de-passe-1")));
  assert.ok(await A.resetPassword(reset!.token, "nouveau-mot-de-passe-1"));
  assert.ok(!(await A.resetPassword(reset!.token, "encore-un-autre-1234")));
  assert.equal(await A.getSessionUser(s.token), null);
  assert.equal((await A.checkCredentials("alice@example.com", input.password)).status, "invalid");
  assert.equal((await A.checkCredentials("alice@example.com", "nouveau-mot-de-passe-1")).status, "ok");
});

test("un nouveau lien invalide l'ancien", opts, async () => {
  const r = await A.signUp(input);
  if (r.status !== "created") throw new Error("inscription");
  const again = await A.reissueVerification("alice@example.com");
  assert.ok(again);
  assert.ok(!(await A.verifyEmail(r.token)));
  assert.ok(await A.verifyEmail(again!.token));
  assert.equal(await A.reissueVerification("alice@example.com"), null); // déjà vérifiée
});

test("suppression de compte : mot de passe exigé, tout disparaît", opts, async () => {
  const S = await import("./store.ts");
  const r = await A.signUp(input);
  if (r.status !== "created") throw new Error("inscription");
  await A.verifyEmail(r.token);
  const host = (await S.getHostByUsername("alice"))!;
  const et = await S.createEventType(host.id, { name: "T", description: "", durationMinutes: 30, locationKind: "video", locationDetail: "", minNoticeMinutes: 0, maxDaysAhead: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, limitPerDay: null, limitPerWeek: null, questions: [], confirmationRedirectUrl: "" });
  await S.createBooking(host, et, { startAt: (await S.listSlots(host, et))[0], guestName: "G", guestEmail: "g@example.com", guestTimezone: "UTC" });
  await A.createSession(r.userId);
  assert.ok(!(await A.deleteAccount(r.userId, "mauvais-mot-de-passe")));
  assert.ok(await A.deleteAccount(r.userId, input.password));
  for (const t of ["users", "profiles", "sessions", "email_tokens", "event_types", "bookings", "availability_rules"]) {
    const n = await DB.query(`select count(*)::int as n from ${t}`);
    assert.equal((n[0] as { n: number }).n, 0, `${t} doit être vide`);
  }
});

test("limite de débit : au-delà du maximum, refus ; clés indépendantes", opts, async () => {
  for (let i = 1; i <= 3; i++) assert.ok((await RL.rateLimit("t:a", 3, 60)).ok);
  assert.ok(!(await RL.rateLimit("t:a", 3, 60)).ok);
  assert.ok((await RL.rateLimit("t:b", 3, 60)).ok);
});
