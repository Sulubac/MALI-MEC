import { test } from "node:test";
import assert from "node:assert/strict";
import { createBooking, getCurrentHost, getEventTypeBySlug, listSlots, cancelBooking } from "./store.ts";
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
