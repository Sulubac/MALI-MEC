// Agenda externe : connexion, plages occupées, contrôle à la réservation, écriture, révocation. Contre le faux Google (e2e/fake-google.ts).
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { FAKE, startFakeGoogle } from "../e2e/fake-google.ts";
import { resetDb, skip } from "./testdb.ts";

const opts = { skip };
const PORT = 3292, BASE = `http://127.0.0.1:${PORT}`;
let fake: Awaited<ReturnType<typeof startFakeGoogle>>;
let S: typeof import("./store.ts"), A: typeof import("./auth-core.ts"), C: typeof import("./calendar.ts"), G: typeof import("./google.ts"),
  W: typeof import("./worker.ts"), DB: typeof import("./db.ts");
let host: import("./types.ts").Host, other: import("./types.ts").Host;
let et: import("./types.ts").EventType;
const control = (path: string, body: unknown = {}) => fetch(`${BASE}/__control/${path}`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());
const fakeState = (email = "host@gmail.test"): Promise<{ events: { id: string; summary: string; description: string; location?: string; start: { dateTime: string; timeZone: string } }[]; deleted: string[]; log: string[]; refreshTokens: { revoked: boolean }[] }> =>
  fetch(`${BASE}/__control/state?email=${encodeURIComponent(email)}`).then((r) => r.json());

const base = {
  name: "Échange", description: "", durationMinutes: 30, locationKind: "video" as const, locationDetail: "Salle 3, étage 2",
  minNoticeMinutes: 0, maxDaysAhead: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, limitPerDay: null, limitPerWeek: null,
  questions: [{ id: "q1", label: "Sujet", kind: "text" as const, options: [], required: false }], confirmationRedirectUrl: "",
};
const guest = { guestName: "Camille", guestEmail: "camille@example.com", guestTimezone: "America/New_York" };

/** Parcours OAuth complet contre le faux Google, puis enregistrement de la connexion. */
async function connect(userId: string) {
  const cfg = G.googleConfig()!;
  const s = G.newOAuthState();
  const res = await fetch(G.authorizationUrl(cfg, { state: s.state, challenge: s.challenge }), { redirect: "manual" });
  const code = new URL(res.headers.get("location")!).searchParams.get("code")!;
  const t = await G.exchangeCode(cfg, code, s.verifier);
  return { tokens: t, result: await C.saveConnection(userId, t as never) };
}
async function mkHost(username: string) {
  const r = await A.signUp({ email: `${username}@example.com`, password: "un-mot-de-passe-solide", username, displayName: username, timezone: "Europe/Paris" });
  if (r.status !== "created") throw new Error("inscription");
  await A.verifyEmail(r.token);
  return (await S.getHostByUsername(username))!;
}
const slotAt = async (i = 0) => (await S.listSlots(host, et))[i];
const runJobs = () => W.processDueJobs(50);
const iso = (ms: number) => new Date(ms).toISOString();

before(async () => {
  if (skip) return;
  fake = await startFakeGoogle(PORT);
  Object.assign(process.env, {
    GOOGLE_CLIENT_ID: FAKE.clientId, GOOGLE_CLIENT_SECRET: FAKE.clientSecret, TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
    GOOGLE_REDIRECT_URI: "http://app.test/api/google/callback", GOOGLE_AUTH_URL: `${BASE}/auth`, GOOGLE_TOKEN_URL: `${BASE}/token`,
    GOOGLE_REVOKE_URL: `${BASE}/revoke`, GOOGLE_API_BASE: `${BASE}/calendar/v3`,
  });
  DB = await import("./db.ts"); S = await import("./store.ts"); A = await import("./auth-core.ts"); C = await import("./calendar.ts");
  G = await import("./google.ts"); W = await import("./worker.ts");
});
after(async () => { if (skip) return; await fake.close(); await DB.closePool(); });
beforeEach(async () => {
  if (skip) return;
  await resetDb(); await control("reset");
  host = await mkHost("alice"); other = await mkHost("bob");
  et = await S.createEventType(host.id, base);
});

test("connexion : le jeton est chiffré en base, lié à l'utilisateur ; vue exacte", opts, async () => {
  const { tokens } = await connect(host.id);
  const row = (await DB.query<{ refresh_token_enc: string; scopes: string; external_account: string }>("select refresh_token_enc, scopes, external_account from calendar_connections"))[0];
  assert.ok(!row.refresh_token_enc.includes(tokens.refreshToken!));
  assert.ok(row.refresh_token_enc.startsWith("v1."));
  assert.equal(row.external_account, "host@gmail.test");
  const v = (await C.getCalendarView(host.id))!;
  assert.deepEqual([v.status, v.email, v.checkBusy, v.writeBookings, v.canWrite], ["active", "host@gmail.test", true, true, true]);
  assert.equal(await C.getCalendarView(other.id), null, "l'autre utilisateur ne voit rien");
  // recopié sur la ligne d'un autre utilisateur, le jeton ne se déchiffre pas
  const { decryptSecret } = await import("./crypto.ts");
  assert.throws(() => decryptSecret(row.refresh_token_enc, other.id));
});

test("un événement de l'agenda retire le créneau, marges comprises ; sans connexion rien n'est retiré", opts, async () => {
  const withBuffer = await S.updateEventType(host.id, et.id, { ...base, bufferAfterMinutes: 15 });
  const slots = await S.listSlots(host, withBuffer!);
  const target = Date.parse(slots[4]);
  await connect(host.id);
  await control("busy", { email: "host@gmail.test", start: iso(target), end: iso(target + 30 * 60_000) });
  const after = await S.listSlots(host, withBuffer!);
  assert.ok(!after.includes(iso(target)), "le créneau occupé disparaît");
  assert.ok(!after.includes(iso(target - 30 * 60_000)), "le créneau d'avant disparaît (marge après de 15 min)");
  assert.ok(after.includes(iso(target + 30 * 60_000)), "le créneau d'après reste libre");
  assert.ok((await S.listSlots(other, await S.createEventType(other.id, base))).length > 0, "l'agenda de l'un n'affecte pas l'autre");
});

test("option « éviter les créneaux occupés » désactivée : l'agenda est ignoré", opts, async () => {
  await connect(host.id);
  const t = Date.parse(await slotAt(3));
  await control("busy", { email: "host@gmail.test", start: iso(t), end: iso(t + 30 * 60_000) });
  assert.ok(!(await S.listSlots(host, et)).includes(iso(t)));
  await C.updateOptions(host.id, { checkBusy: false, writeBookings: true });
  assert.ok((await S.listSlots(host, et)).includes(iso(t)));
});

test("contrôle à la réservation : un événement ajouté après l'affichage est détecté, rien n'est enregistré", opts, async () => {
  await connect(host.id);
  const slot = await slotAt(2);
  assert.ok(slot);
  const t = Date.parse(slot);
  await control("busy", { email: "host@gmail.test", start: iso(t + 10 * 60_000), end: iso(t + 40 * 60_000) }); // ajouté après l'affichage (cache)
  await assert.rejects(S.createBooking(host, et, { startAt: slot, ...guest }), { message: "slot_taken" });
  assert.equal((await DB.query("select 1 from bookings")).length, 0);
});

test("Google injoignable à la réservation : refus propre, aucune réservation ; l'affichage continue", opts, async () => {
  await connect(host.id);
  const slot = await slotAt(1);
  await control("fail", { target: "freebusy", status: 503, times: 1 });
  await assert.rejects(S.createBooking(host, et, { startAt: slot, ...guest }), { message: "calendar_unavailable" });
  assert.equal((await DB.query("select 1 from bookings")).length, 0);
  assert.ok((await S.listSlots(host, et)).length > 0, "la page publique reste utilisable");
  const b = await S.createBooking(host, et, { startAt: slot, ...guest }); // Google revenu
  assert.equal(b.status, "confirmed");
});

test("réservation → événement créé dans l'agenda (titre, heure, fuseau, lieu, coordonnées) ; rejouer ne duplique pas", opts, async () => {
  await connect(host.id);
  const slot = await slotAt(2);
  const b = await S.createBooking(host, et, { startAt: slot, ...guest, answers: { q1: "Un projet" } });
  await runJobs();
  let st = await fakeState();
  assert.equal(st.events.length, 1);
  const e = st.events[0];
  assert.equal(e.id, G.eventIdFor(b.id));
  assert.equal(e.summary, "Échange : Camille");
  assert.equal(e.start.dateTime, slot);
  assert.equal(e.start.timeZone, "Europe/Paris");
  assert.equal(e.location, "Salle 3, étage 2");
  assert.match(e.description, /camille@example\.com/);
  assert.match(e.description, /Sujet : Un projet/);
  assert.equal((await DB.query<{ external_event_id: string }>("select external_event_id from bookings where id = $1", [b.id]))[0].external_event_id, e.id);
  await C.runCalendarJob({ op: "create", bookingId: b.id }); // rejeu
  st = await fakeState();
  assert.equal(st.events.length, 1);
});

test("annulation → événement supprimé ; replanification → ancien supprimé, nouveau créé", opts, async () => {
  await connect(host.id);
  const [s1, s2, s3] = [await slotAt(2), await slotAt(5), await slotAt(8)];
  const a = await S.createBooking(host, et, { startAt: s1, ...guest });
  await runJobs();
  assert.equal((await fakeState()).events.length, 1);
  const b = await S.createBooking(host, et, { startAt: s2, ...guest, rescheduleToken: a.manageToken });
  await runJobs();
  let st = await fakeState();
  assert.deepEqual(st.events.map((e) => e.id), [G.eventIdFor(b.id)]);
  assert.ok(st.deleted.includes(G.eventIdFor(a.id)));
  await S.cancelBooking(b.manageToken, "guest", "empêchement");
  await runJobs();
  st = await fakeState();
  assert.equal(st.events.length, 0);
  void s3;
});

test("annulée avant l'écriture : l'événement n'est jamais créé", opts, async () => {
  await connect(host.id);
  const b = await S.createBooking(host, et, { startAt: await slotAt(2), ...guest });
  await S.cancelBooking(b.manageToken, "guest", "");
  await runJobs();
  assert.equal((await fakeState()).events.length, 0);
});

test("écriture désactivée ou connexion absente : aucune tâche d'écriture", opts, async () => {
  await S.createBooking(host, et, { startAt: await slotAt(0), ...guest }); // pas connecté
  assert.equal((await DB.query("select 1 from jobs where kind = 'calendar_write'")).length, 0);
  await connect(host.id);
  await C.updateOptions(host.id, { checkBusy: true, writeBookings: false });
  await S.createBooking(host, et, { startAt: await slotAt(4), ...guest });
  assert.equal((await DB.query("select 1 from jobs where kind = 'calendar_write'")).length, 0);
});

test("consentement partiel (sans écriture) : lecture seule, l'écriture ne peut pas être activée", opts, async () => {
  await control("options", { deniedScopes: ["https://www.googleapis.com/auth/calendar.events"] });
  const { result } = await connect(host.id);
  assert.equal(result.canWrite, false);
  const v = (await C.getCalendarView(host.id))!;
  assert.deepEqual([v.writeBookings, v.canWrite], [false, false]);
  await C.updateOptions(host.id, { checkBusy: true, writeBookings: true });
  assert.equal((await C.getCalendarView(host.id))!.writeBookings, false);
  const t = Date.parse(await slotAt(3));
  await control("busy", { email: "host@gmail.test", start: iso(t), end: iso(t + 30 * 60_000) });
  assert.ok(!(await S.listSlots(host, et)).includes(iso(t)), "la lecture fonctionne");
});

test("erreur temporaire à l'écriture : nouvelle tentative, puis succès", opts, async () => {
  await connect(host.id);
  await S.createBooking(host, et, { startAt: await slotAt(2), ...guest });
  await control("fail", { target: "events", status: 500, times: 1 });
  let r = await runJobs();
  assert.ok(r.retried >= 1);
  assert.equal((await fakeState()).events.length, 0);
  await DB.query("update jobs set run_at = now() where status = 'pending' and kind = 'calendar_write'");
  r = await runJobs();
  assert.equal((await fakeState()).events.length, 1);
});

test("jeton d'accès expiré (401) : rafraîchi automatiquement, l'appel réussit", opts, async () => {
  await connect(host.id);
  const t = Date.parse(await slotAt(3));
  await control("busy", { email: "host@gmail.test", start: iso(t), end: iso(t + 30 * 60_000) });
  assert.ok(!(await S.listSlots(host, et)).includes(iso(t))); // met un jeton en cache
  await control("expire-access");
  await assert.doesNotReject(S.createBooking(host, et, { startAt: await slotAt(6), ...guest })); // fresh → 401 → refresh → ok
});

test("accès révoqué chez Google : connexion « révoquée », un seul e-mail de reconnexion, les créneaux ne sont plus filtrés", opts, async () => {
  await connect(host.id);
  const t = Date.parse(await slotAt(3));
  await control("busy", { email: "host@gmail.test", start: iso(t), end: iso(t + 30 * 60_000) });
  assert.ok(!(await S.listSlots(host, et)).includes(iso(t)));
  await control("revoke-all", { email: "host@gmail.test" });
  await C.externalBusy(host.id, Date.now(), Date.now() + 86400_000, { fresh: true });
  await C.externalBusy(host.id, Date.now(), Date.now() + 86400_000, { fresh: true }); // deuxième appel : pas de second e-mail
  const v = (await C.getCalendarView(host.id))!;
  assert.equal(v.status, "revoked");
  assert.match(v.lastError!, /reconnectez/);
  assert.ok((await S.listSlots(host, et)).includes(iso(t)), "le calendrier révoqué n'est plus consulté");
  await runJobs();
  const mails = await DB.query<{ to_address: string; subject: string; body_text: string }>("select to_address, subject, body_text from email_outbox where subject like 'Reconnectez%'");
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to_address, "alice@example.com");
  assert.ok(mails[0].body_text.includes("http://app.test/integrations"));
  const b = await S.createBooking(host, et, { startAt: iso(t), ...guest }); // la réservation continue de fonctionner
  assert.equal(b.status, "confirmed");
  assert.equal((await DB.query("select 1 from jobs where kind = 'calendar_write'")).length, 0, "plus d'écriture sur une connexion révoquée");
});

test("reconnecter remet la connexion en service", opts, async () => {
  await connect(host.id);
  await control("revoke-all", { email: "host@gmail.test" });
  await C.externalBusy(host.id, Date.now(), Date.now() + 86400_000, { fresh: true });
  assert.equal((await C.getCalendarView(host.id))!.status, "revoked");
  await connect(host.id);
  const v = (await C.getCalendarView(host.id))!;
  assert.deepEqual([v.status, v.lastError], ["active", null]);
});

test("déconnexion : accès révoqué chez Google, ligne supprimée, écritures en attente ignorées", opts, async () => {
  await connect(host.id);
  await S.createBooking(host, et, { startAt: await slotAt(2), ...guest });
  await C.disconnect(host.id);
  assert.equal(await C.getCalendarView(host.id), null);
  assert.equal((await fakeState()).refreshTokens[0].revoked, true);
  await runJobs();
  assert.equal((await fakeState()).events.length, 0);
  assert.equal((await DB.query("select 1 from jobs where kind = 'calendar_write' and status = 'failed'")).length, 0);
});

test("suppression du compte : l'accès Google est révoqué (crochet) puis tout est effacé", opts, async () => {
  await connect(host.id);
  assert.ok(await A.deleteAccount(host.id, "un-mot-de-passe-solide", async () => { await C.disconnect(host.id); }));
  assert.equal((await fakeState()).refreshTokens[0].revoked, true);
  assert.equal((await DB.query("select 1 from calendar_connections")).length, 0);
  assert.ok(!(await A.deleteAccount(other.id, "mauvais", async () => { throw new Error("ne doit pas être appelé"); })));
});

test("clé de chiffrement perdue ou changée : connexion « révoquée » et hôte prévenu, les réservations continuent (pas de blocage définitif)", opts, async () => {
  await connect(host.id);
  const good = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64"); // une autre clé
  try {
    const slot = await slotAt(2);
    const b = await S.createBooking(host, et, { startAt: slot, ...guest }); // ne doit pas être bloquée
    assert.equal(b.status, "confirmed");
    const v = (await C.getCalendarView(host.id))!;
    assert.equal(v.status, "revoked");
    assert.match(v.lastError!, /clé de chiffrement/i);
    await runJobs();
    assert.equal((await DB.query("select 1 from email_outbox where subject like 'Reconnectez%'")).length, 1);
  } finally {
    process.env.TOKEN_ENCRYPTION_KEY = good;
  }
});

test("Google répond 403 (API désactivée, autorisation insuffisante) : l'hôte est prévenu et les réservations continuent", opts, async () => {
  await connect(host.id);
  await control("fail", { target: "freebusy", status: 403, times: 5 });
  const slot = await slotAt(2);
  const b = await S.createBooking(host, et, { startAt: slot, ...guest });
  assert.equal(b.status, "confirmed");
  const v = (await C.getCalendarView(host.id))!;
  assert.equal(v.status, "revoked");
  assert.match(v.lastError!, /refusé l'accès|autorisation/i);
});

test("échec d'écriture non temporaire : message lisible pour l'hôte, détail technique gardé dans la file", opts, async () => {
  await connect(host.id);
  await S.createBooking(host, et, { startAt: await slotAt(2), ...guest });
  await control("fail", { target: "events", status: 403, times: 10 });
  await runJobs();
  const v = (await C.getCalendarView(host.id))!;
  assert.ok(v.lastError && !/\{|"error"|403/.test(v.lastError), `message lisible attendu, reçu : ${v.lastError}`);
  assert.match(v.lastError!, /refusé|autorisation/i);
  const j = (await DB.query<{ last_error: string }>("select last_error from jobs where kind = 'calendar_write'"))[0];
  assert.match(j.last_error, /403/); // le détail reste disponible pour le diagnostic
});

// ===== Deuxième passe de test : hypothèses de défauts =====
test("reconnecter révoque l'ancien jeton chez Google (sinon il reste valable, orphelin)", opts, async () => {
  await connect(host.id);
  await connect(host.id); // reconnexion : un nouveau jeton remplace l'ancien en base
  const st = await fakeState();
  assert.equal(st.refreshTokens.length, 2);
  assert.equal(st.refreshTokens.filter((t) => !t.revoked).length, 1, "un seul jeton doit rester valable chez Google");
});

test("Google refuse la requête (400, durable) : l'hôte est prévenu et les réservations continuent (pas de blocage)", opts, async () => {
  await connect(host.id);
  await control("fail", { target: "freebusy", status: 400, times: 5 });
  const b = await S.createBooking(host, et, { startAt: await slotAt(2), ...guest });
  assert.equal(b.status, "confirmed");
  assert.match((await C.getCalendarView(host.id))!.lastError ?? "", /rejeté|refusé/i);
});

test("10 réservations simultanées avec l'agenda connecté : une seule réussit, un seul événement Google", opts, async () => {
  await connect(host.id);
  const slot = await slotAt(2);
  const res = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => S.createBooking(host, et, { startAt: slot, ...guest, guestEmail: `g${i}@example.com` })));
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
  await runJobs();
  assert.equal((await fakeState()).events.length, 1);
});

test("événement sur toute la journée : tous les créneaux du jour disparaissent", opts, async () => {
  await connect(host.id);
  const slots = await S.listSlots(host, et);
  const day = slots[0].slice(0, 10);
  const sameDay = slots.filter((s) => s.startsWith(day));
  assert.ok(sameDay.length > 3);
  await control("busy", { email: "host@gmail.test", start: `${day}T00:00:00Z`, end: `${day}T23:59:59Z` });
  assert.equal((await S.listSlots(host, et)).filter((s) => s.startsWith(day)).length, 0);
});

test("changement d'heure d'automne : l'événement garde l'instant exact et le fuseau de l'hôte (09:00 à Paris avant et après)", opts, async () => {
  await connect(host.id);
  const all = await S.listSlots(host, et, Date.parse("2026-10-20T00:00:00Z"));
  const before = all.find((s) => s.startsWith("2026-10-23") && new Date(s).getUTCHours() === 7)!; // 09:00 CEST = 07:00Z
  const after = all.find((s) => s.startsWith("2026-10-27") && new Date(s).getUTCHours() === 8)!;   // 09:00 CET = 08:00Z
  assert.ok(before && after);
  for (const s of [before, after]) await S.createBooking(host, et, { startAt: s, ...guest, guestEmail: `${s.slice(8, 10)}@example.com` }, Date.parse("2026-10-20T00:00:00Z"));
  await runJobs();
  const local = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  const evs = (await fakeState()).events;
  assert.equal(evs.length, 2);
  for (const e of evs) { assert.equal(e.start.timeZone, "Europe/Paris"); assert.equal(local.format(new Date(e.start.dateTime)), "09:00"); }
});

test("accents, emoji, nom de 120 caractères, retours à la ligne dans une réponse : événement lisible, sans saut de ligne dans le titre", opts, async () => {
  await connect(host.id);
  await S.updateEventType(host.id, et.id, { ...base, name: "Séance ☕ d'été" });
  const t = (await S.getOwnedEventType(host.id, et.id))!;
  const longName = "Éloïse 😀 " + "N".repeat(110);
  await S.createBooking(host, t, { startAt: await slotAt(2), ...guest, guestName: longName, answers: { q1: "ligne 1\nligne 2 😀" } });
  await runJobs();
  const e = (await fakeState()).events[0];
  assert.equal(e.summary, `Séance ☕ d'été : ${longName}`);
  assert.ok(!/[\r\n]/.test(e.summary));
  assert.match(e.description, /ligne 1\nligne 2 😀/);
});

