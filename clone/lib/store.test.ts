import { test } from "node:test";
import assert from "node:assert/strict";
import { createBooking, getCurrentHost, getEventTypeBySlug, listSlots, cancelBooking, createEventType, updateEventType, deleteEventType, setOverrides } from "./store.ts";
import { SlotTakenError, SlotUnavailableError } from "./types.ts";

const host = getCurrentHost();
const et = getEventTypeBySlug(host.id, "echange-30")!;
const guest = { guestName: "Camille", guestEmail: "camille@example.com", guestTimezone: "Europe/Paris" };

test("réserver un créneau libre puis le même est refusé", () => {
  const slot = listSlots(host, et)[0];
  const b = createBooking(host, et, { startAt: slot, ...guest });
  assert.equal(b.status, "confirmed");
  assert.throws(() => createBooking(host, et, { startAt: slot, ...guest }), SlotTakenError);
  assert.ok(!listSlots(host, et).includes(slot));
});

test("un créneau hors disponibilités est refusé", () => {
  assert.throws(() => createBooking(host, et, { startAt: "2020-01-01T03:00:00Z", ...guest }), SlotUnavailableError);
});

test("annuler libère le créneau", () => {
  const slot = listSlots(host, et)[1];
  const b = createBooking(host, et, { startAt: slot, ...guest });
  cancelBooking(b.manageToken, "guest", "empêchement");
  assert.ok(listSlots(host, et).includes(slot));
});

const defaults = {
  name: "Tmp", description: "", durationMinutes: 30, locationKind: "video" as const, locationDetail: "",
  minNoticeMinutes: 0, maxDaysAhead: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, limitPerDay: null, limitPerWeek: null,
  questions: [], confirmationRedirectUrl: "",
};

test("modifier un type garde son lien", () => {
  const t = createEventType(host.id, defaults);
  const slug = t.slug;
  updateEventType(host.id, t.id, { ...defaults, name: "Autre nom", bufferAfterMinutes: 15 });
  assert.equal(getEventTypeBySlug(host.id, slug)?.name, "Autre nom");
  assert.equal(getEventTypeBySlug(host.id, slug)?.bufferAfterMinutes, 15);
});

test("supprimer : libre sans réservation, refusé avec réservation", () => {
  const free = createEventType(host.id, { ...defaults, name: "Sans résa" });
  assert.equal(deleteEventType(host.id, free.id), "deleted");
  assert.equal(getEventTypeBySlug(host.id, "sans-resa"), null);
  const used = createEventType(host.id, { ...defaults, name: "Avec résa" });
  createBooking(host, used, { startAt: listSlots(host, used)[0], ...guest });
  assert.equal(deleteEventType(host.id, used.id), "has_bookings");
  assert.equal(deleteEventType("autre-hote", used.id), "not_found");
});

test("une exception « indisponible » retire la journée des créneaux", () => {
  const t = createEventType(host.id, { ...defaults, name: "Exc" });
  const day = listSlots(host, t)[0].slice(0, 10);
  const before = listSlots(host, t).filter((x) => x.startsWith(day)).length;
  assert.ok(before > 0);
  setOverrides(host.id, [{ date: day, ranges: [] }]);
  assert.equal(listSlots(host, t).filter((x) => x.startsWith(day)).length, 0);
  setOverrides(host.id, []);
});
