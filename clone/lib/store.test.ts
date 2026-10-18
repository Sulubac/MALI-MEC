import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { resetDb, skip } from "./testdb.ts";

const opts = { skip };
let S: typeof import("./store.ts");
let A: typeof import("./auth-core.ts");
let DB: typeof import("./db.ts");
let host: import("./types.ts").Host;
let other: import("./types.ts").Host;
const guest = { guestName: "Camille", guestEmail: "camille@example.com", guestTimezone: "Europe/Paris" };
const defaults = {
  name: "Échange", description: "", durationMinutes: 30, locationKind: "video" as const, locationDetail: "",
  minNoticeMinutes: 0, maxDaysAhead: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, limitPerDay: null, limitPerWeek: null,
  questions: [], confirmationRedirectUrl: "",
};

async function mkHost(username: string) {
  const r = await A.signUp({ email: `${username}@example.com`, password: "un-mot-de-passe-solide", username, displayName: username, timezone: "Europe/Paris" });
  assert.equal(r.status, "created");
  const h = await S.getHostByUsername(username);
  assert.ok(h);
  return h!;
}

before(async () => {
  if (skip) return;
  DB = await import("./db.ts"); S = await import("./store.ts"); A = await import("./auth-core.ts");
});
after(async () => { if (!skip) await DB.closePool(); });
beforeEach(async () => {
  if (skip) return;
  await resetDb();
  host = await mkHost("alice"); other = await mkHost("bob");
});

test("réserver un créneau libre, puis le même est refusé", opts, async () => {
  const et = await S.createEventType(host.id, defaults);
  const slot = (await S.listSlots(host, et))[0];
  const b = await S.createBooking(host, et, { startAt: slot, ...guest });
  assert.equal(b.status, "confirmed");
  await assert.rejects(S.createBooking(host, et, { startAt: slot, ...guest }), { message: "slot_taken" });
  assert.ok(!(await S.listSlots(host, et)).includes(slot));
});

test("10 réservations simultanées du même créneau : une seule réussit", opts, async () => {
  const et = await S.createEventType(host.id, defaults);
  const slot = (await S.listSlots(host, et))[0];
  const res = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => S.createBooking(host, et, { startAt: slot, ...guest, guestEmail: `g${i}@example.com` })));
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(res.filter((r) => r.status === "rejected" && /slot_/.test(String((r as PromiseRejectedResult).reason?.message))).length, 9);
  const n = await DB.query("select count(*)::int as n from bookings where host_id = $1", [host.id]);
  assert.equal((n[0] as { n: number }).n, 1);
});

test("limite par jour exacte sous concurrence", opts, async () => {
  const et = await S.createEventType(host.id, { ...defaults, limitPerDay: 2 });
  const slots = await S.listSlots(host, et);
  const day = slots[0].slice(0, 10);
  const sameDay = slots.filter((s) => s.startsWith(day)).slice(0, 6);
  assert.ok(sameDay.length >= 4);
  const res = await Promise.allSettled(sameDay.map((s, i) => S.createBooking(host, et, { startAt: s, ...guest, guestEmail: `g${i}@example.com` })));
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 2);
});

test("un créneau hors disponibilités est refusé", opts, async () => {
  const et = await S.createEventType(host.id, defaults);
  await assert.rejects(S.createBooking(host, et, { startAt: "2020-01-01T03:00:00Z", ...guest }), { message: "slot_unavailable" });
});

test("annuler libère le créneau et met les e-mails en file", opts, async () => {
  const et = await S.createEventType(host.id, defaults);
  const slot = (await S.listSlots(host, et))[1];
  const b = await S.createBooking(host, et, { startAt: slot, ...guest });
  const c = await S.cancelBooking(b.manageToken, "guest", "empêchement");
  assert.equal(c?.status, "cancelled");
  assert.ok((await S.listSlots(host, et)).includes(slot));
  const jobs = await DB.query("select payload->>'template' as t from jobs order by created_at");
  assert.deepEqual(jobs.map((j) => (j as { t: string }).t).sort(), ["booking_cancelled", "booking_cancelled", "booking_confirmation", "booking_host_notification"].concat(
    jobs.some((j) => (j as { t: string }).t === "booking_reminder") ? ["booking_reminder"] : []).sort());
});

test("replanifier annule l'ancienne réservation dans la même transaction", opts, async () => {
  const et = await S.createEventType(host.id, defaults);
  const [s1, s2] = await S.listSlots(host, et);
  const first = await S.createBooking(host, et, { startAt: s1, ...guest });
  const second = await S.createBooking(host, et, { startAt: s2, ...guest, rescheduleToken: first.manageToken });
  const ctx1 = await S.getBookingContext(first.manageToken);
  assert.equal(ctx1?.booking.status, "cancelled");
  assert.equal(second.status, "confirmed");
  // mauvais e-mail : l'ancienne réservation n'est pas touchée
  const [, , s3, s4] = await S.listSlots(host, et);
  const keep = await S.createBooking(host, et, { startAt: s3, ...guest });
  await S.createBooking(host, et, { startAt: s4, ...guest, guestEmail: "autre@example.com", rescheduleToken: keep.manageToken });
  assert.equal((await S.getBookingContext(keep.manageToken))?.booking.status, "confirmed");
});

test("modifier un type garde son lien ; deux types au même nom ont deux liens", opts, async () => {
  const t = await S.createEventType(host.id, defaults);
  const t2 = await S.createEventType(host.id, defaults);
  assert.notEqual(t.slug, t2.slug);
  await S.updateEventType(host.id, t.id, { ...defaults, name: "Autre nom", bufferAfterMinutes: 15 });
  const again = await S.getEventTypeBySlug(host.id, t.slug);
  assert.equal(again?.name, "Autre nom");
  assert.equal(again?.bufferAfterMinutes, 15);
});

test("supprimer : libre sans réservation, refusé avec réservation", opts, async () => {
  const free = await S.createEventType(host.id, { ...defaults, name: "Sans résa" });
  assert.equal(await S.deleteEventType(host.id, free.id), "deleted");
  const used = await S.createEventType(host.id, { ...defaults, name: "Avec résa" });
  await S.createBooking(host, used, { startAt: (await S.listSlots(host, used))[0], ...guest });
  assert.equal(await S.deleteEventType(host.id, used.id), "has_bookings");
});

test("sauvegarde des disponibilités : plages, exceptions, fuseau", opts, async () => {
  await S.saveAvailability(host.id, [{ weekday: 1, start: "09:00", end: "12:00" }, { weekday: 1, start: "14:00", end: "17:00" }],
    [{ date: "2030-12-24", ranges: [] }, { date: "2030-12-31", ranges: [{ start: "10:00", end: "12:00" }] }], "America/New_York");
  assert.deepEqual(await S.getRules(host.id), [{ weekday: 1, start: "09:00", end: "12:00" }, { weekday: 1, start: "14:00", end: "17:00" }]);
  assert.deepEqual(await S.getOverrides(host.id), [{ date: "2030-12-24", ranges: [] }, { date: "2030-12-31", ranges: [{ start: "10:00", end: "12:00" }] }]);
  assert.equal((await S.getHostById(host.id))?.timezone, "America/New_York");
});

// ----- Cloisonnement : un deuxième utilisateur n'obtient rien -----
test("cloisonnement : bob ne voit ni ne modifie rien d'alice", opts, async () => {
  const et = await S.createEventType(host.id, defaults);
  const b = await S.createBooking(host, et, { startAt: (await S.listSlots(host, et))[0], ...guest });
  assert.deepEqual(await S.listEventTypes(other.id), []);
  assert.deepEqual(await S.listBookings(other.id), []);
  assert.equal(await S.getOwnedEventType(other.id, et.id), null);
  assert.equal(await S.updateEventType(other.id, et.id, { ...defaults, name: "Piraté" }), null);
  assert.equal(await S.deleteEventType(other.id, et.id), "not_found");
  await S.setEventTypeActive(other.id, et.id, false);
  assert.equal((await S.getOwnedEventType(host.id, et.id))?.active, true);
  assert.equal(await S.cancelBooking(b.manageToken, "host", "x", other.id), null); // pas l'hôte
  assert.equal((await S.getBookingContext(b.manageToken))?.booking.status, "confirmed");
  assert.equal((await S.cancelBooking(b.manageToken, "host", "ok", host.id))?.status, "cancelled");
});
