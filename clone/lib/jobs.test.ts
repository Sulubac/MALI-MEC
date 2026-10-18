import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { resetDb, skip } from "./testdb.ts";

const opts = { skip };
let S: typeof import("./store.ts"), A: typeof import("./auth-core.ts"), W: typeof import("./worker.ts"), DB: typeof import("./db.ts"), E: typeof import("./email.ts");
let host: import("./types.ts").Host, et: import("./types.ts").EventType;
const guest = { guestName: "Camille", guestEmail: "camille@example.com", guestTimezone: "America/New_York" };

before(async () => { if (!skip) { DB = await import("./db.ts"); S = await import("./store.ts"); A = await import("./auth-core.ts"); W = await import("./worker.ts"); E = await import("./email.ts"); } });
after(async () => { if (!skip) await DB.closePool(); });
beforeEach(async () => {
  if (skip) return;
  await resetDb();
  const r = await A.signUp({ email: "alice@example.com", password: "un-mot-de-passe-solide", username: "alice", displayName: "Alice Martin", timezone: "Europe/Paris" });
  if (r.status !== "created") throw new Error("inscription");
  await A.verifyEmail(r.token);
  host = (await S.getHostByUsername("alice"))!;
  et = await S.createEventType(host.id, { name: "Échange", description: "", durationMinutes: 30, locationKind: "video", locationDetail: "", minNoticeMinutes: 0, maxDaysAhead: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, limitPerDay: null, limitPerWeek: null, questions: [], confirmationRedirectUrl: "" });
});

test("une réservation envoie confirmation à l'invité et notification à l'hôte, dans leurs fuseaux", opts, async () => {
  const b = await S.createBooking(host, et, { startAt: (await S.listSlots(host, et))[0], ...guest });
  const r = await W.processDueJobs();
  assert.ok(r.done >= 2);
  const out = await DB.query<{ to_address: string; subject: string; body_text: string }>("select to_address, subject, body_text from email_outbox order by created_at");
  const toGuest = out.find((m) => m.to_address === "camille@example.com")!;
  const toHost = out.find((m) => m.to_address === "alice@example.com")!;
  assert.match(toGuest.subject, /Rendez-vous confirmé/);
  assert.ok(toGuest.body_text.includes(`http://app.test/booking/${b.manageToken}`));
  assert.match(toGuest.body_text, /EDT|EST|UTC−|GMT−/); // fuseau de l'invité
  assert.match(toHost.subject, /Nouvelle réservation/);
  assert.match(toHost.body_text, /CET|CEST|UTC\+|GMT\+/);
});

test("le rappel est programmé 24 h avant et n'est pas envoyé trop tôt", opts, async () => {
  const slots = await S.listSlots(host, et, Date.now());
  const far = slots.find((s) => Date.parse(s) > Date.now() + 3 * 24 * 3600_000)!;
  await S.createBooking(host, et, { startAt: far, ...guest });
  const j = await DB.query<{ run_at: Date }>("select run_at from jobs where payload->>'template' = 'booking_reminder'");
  assert.equal(j.length, 1);
  assert.equal(j[0].run_at.getTime(), Date.parse(far) - 24 * 3600_000);
  await W.processDueJobs();
  assert.equal((await DB.query("select 1 from email_outbox where subject like 'Rappel%'")).length, 0);
  await DB.query("update jobs set run_at = now() where payload->>'template' = 'booking_reminder'");
  await W.processDueJobs();
  assert.equal((await DB.query("select 1 from email_outbox where subject like 'Rappel%'")).length, 1);
});

test("réservation annulée : confirmation et rappel ne sont plus envoyés, l'annulation l'est", opts, async () => {
  const far = (await S.listSlots(host, et)).find((s) => Date.parse(s) > Date.now() + 3 * 24 * 3600_000)!;
  const b = await S.createBooking(host, et, { startAt: far, ...guest });
  await S.cancelBooking(b.manageToken, "guest", "empêchement");
  await DB.query("update jobs set run_at = now()");
  await W.processDueJobs();
  const subjects = (await DB.query<{ subject: string }>("select subject from email_outbox")).map((m) => m.subject);
  assert.equal(subjects.filter((s) => /annulé|annulée/i.test(s)).length, 2);
  assert.equal(subjects.filter((s) => /confirmé|Rappel|Nouvelle réservation/.test(s)).length, 0);
});

test("l'idempotence évite les doublons d'e-mails", opts, async () => {
  const b = await S.createBooking(host, et, { startAt: (await S.listSlots(host, et))[0], ...guest });
  const Q = await import("./queue.ts");
  await Q.enqueueEmail(DB.pool(), { template: "booking_confirmation", bookingId: b.id, audience: "guest" });
  const n = await DB.query("select count(*)::int as n from jobs where payload->>'template' = 'booking_confirmation'");
  assert.equal((n[0] as { n: number }).n, 1);
});

test("échec d'envoi : nouvelle tentative avec attente, puis lettre morte avec l'erreur", opts, async () => {
  await S.createBooking(host, et, { startAt: (await S.listSlots(host, et))[0], ...guest });
  process.env.EMAIL_TRANSPORT = "none";
  try {
    let r = await W.processDueJobs();
    assert.ok(r.retried >= 1 && r.done === 0);
    const retry = await DB.query<{ status: string; attempts: number; last_error: string; run_at: Date }>("select status, attempts, last_error, run_at from jobs limit 1");
    assert.equal(retry[0].status, "pending");
    assert.equal(retry[0].attempts, 1);
    assert.match(retry[0].last_error, /Aucun fournisseur/);
    assert.ok(retry[0].run_at.getTime() > Date.now() + 60_000); // attente avant le prochain essai
    for (let i = 0; i < 6; i++) { await DB.query("update jobs set run_at = now() where status = 'pending'"); r = await W.processDueJobs(); }
    const dead = await DB.query<{ status: string; attempts: number }>("select status, attempts from jobs");
    assert.ok(dead.every((j) => j.status === "failed" && j.attempts === 5));
  } finally {
    process.env.EMAIL_TRANSPORT = "outbox";
  }
  // rétabli : une tâche en échec ne repart pas toute seule (elle reste consultable)
  assert.equal((await W.processDueJobs()).done, 0);
});

test("choix du transport d'e-mail", opts, () => {
  assert.equal(E.transport({ NODE_ENV: "development" } as NodeJS.ProcessEnv), "outbox");
  assert.equal(E.transport({ NODE_ENV: "production" } as NodeJS.ProcessEnv), "none");
  assert.equal(E.transport({ NODE_ENV: "production", RESEND_API_KEY: "re_x" } as NodeJS.ProcessEnv), "resend");
  assert.equal(E.transport({ NODE_ENV: "production", EMAIL_TRANSPORT: "outbox" } as NodeJS.ProcessEnv), "outbox");
});

test("Resend : requête conforme, erreur remontée quand l'API refuse", async () => {
  const realFetch = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  const env = { ...process.env };
  process.env.EMAIL_TRANSPORT = "resend"; process.env.RESEND_API_KEY = "re_cle_de_test"; process.env.EMAIL_FROM = "Planifier <rdv@exemple.fr>";
  try {
    globalThis.fetch = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response('{"id":"x"}', { status: 200 }); }) as typeof fetch;
    await E.sendEmail({ to: "a@example.com", subject: "Sujet", text: "Corps" });
    assert.equal(calls[0].url, "https://api.resend.com/emails");
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer re_cle_de_test");
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { from: "Planifier <rdv@exemple.fr>", to: ["a@example.com"], subject: "Sujet", text: "Corps" });
    globalThis.fetch = (async () => new Response('{"message":"domaine non vérifié"}', { status: 403 })) as typeof fetch;
    await assert.rejects(E.sendEmail({ to: "a@example.com", subject: "S", text: "C" }), /Resend 403/);
    delete process.env.RESEND_API_KEY;
    await assert.rejects(E.sendEmail({ to: "a@example.com", subject: "S", text: "C" }), /requis/);
  } finally {
    globalThis.fetch = realFetch;
    process.env.EMAIL_TRANSPORT = "outbox";
    for (const k of ["RESEND_API_KEY", "EMAIL_FROM"]) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  }
});
