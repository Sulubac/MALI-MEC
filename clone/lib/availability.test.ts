import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlots, zonedToUtc, localDate } from "./availability.ts";

const base = {
  durationMinutes: 30, stepMinutes: 30, minNoticeMinutes: 0, maxDaysAhead: 14,
  bufferBeforeMinutes: 0, bufferAfterMinutes: 0, limitPerDay: null,
};
const monday9to11 = [{ weekday: 1, start: "09:00", end: "11:00" }];
// lundi 2026-11-02 00:00 UTC (Paris = UTC+1 en novembre)
const NOW = Date.UTC(2026, 10, 1, 12, 0);

test("créneaux dans la plage, convertis en UTC", () => {
  const s = computeSlots({ rules: monday9to11, hostTz: "Europe/Paris", slot: base, busy: [], now: NOW });
  assert.equal(s[0], "2026-11-02T08:00:00.000Z"); // 09:00 Paris
  assert.equal(s[3], "2026-11-02T09:30:00.000Z"); // dernier créneau 10:30
  assert.equal(s.filter((x) => x.startsWith("2026-11-02")).length, 4);
});

test("préavis minimum retire les créneaux trop proches", () => {
  const now = Date.UTC(2026, 10, 2, 8, 10); // 09:10 Paris
  const s = computeSlots({ rules: monday9to11, hostTz: "Europe/Paris", slot: { ...base, minNoticeMinutes: 60 }, busy: [], now });
  assert.ok(!s.includes("2026-11-02T08:00:00.000Z"));
  assert.ok(!s.includes("2026-11-02T09:00:00.000Z")); // 10:00 Paris < 10:10
  assert.ok(s.includes("2026-11-02T09:30:00.000Z"));
});

test("une réservation existante retire le créneau et le tampon", () => {
  const busy = [{ start: Date.UTC(2026, 10, 2, 8, 30), end: Date.UTC(2026, 10, 2, 9, 0) }];
  const s = computeSlots({ rules: monday9to11, hostTz: "Europe/Paris", slot: { ...base, bufferAfterMinutes: 30 }, busy, now: NOW });
  assert.ok(!s.includes("2026-11-02T08:30:00.000Z"));
  assert.ok(!s.includes("2026-11-02T08:00:00.000Z")); // tampon après : finit 09:00 > début 08:30
  assert.ok(s.includes("2026-11-02T09:30:00.000Z"));
});

test("limite par jour", () => {
  const busy = [{ start: Date.UTC(2026, 10, 2, 8, 0), end: Date.UTC(2026, 10, 2, 8, 30) }];
  const s = computeSlots({ rules: monday9to11, hostTz: "Europe/Paris", slot: { ...base, limitPerDay: 1 }, busy, now: NOW });
  assert.equal(s.filter((x) => x.startsWith("2026-11-02")).length, 0);
});

test("heure d'été : 09:00 Paris vaut 07:00 UTC en été, 08:00 UTC en hiver", () => {
  assert.equal(new Date(zonedToUtc(2026, 7, 6, 9, 0, "Europe/Paris")!).toISOString(), "2026-07-06T07:00:00.000Z");
  assert.equal(new Date(zonedToUtc(2026, 12, 7, 9, 0, "Europe/Paris")!).toISOString(), "2026-12-07T08:00:00.000Z");
});

test("trou d'heure d'été : 02:30 le 29 mars 2026 à Paris n'existe pas", () => {
  assert.equal(zonedToUtc(2026, 3, 29, 2, 30, "Europe/Paris"), null);
});

test("changement d'heure : le créneau de 09:00 reste à 09:00 locale avant et après", () => {
  const rules = [{ weekday: 1, start: "09:00", end: "09:30" }];
  const s = computeSlots({ rules, hostTz: "Europe/Paris", slot: { ...base, maxDaysAhead: 10 }, busy: [], now: Date.UTC(2026, 2, 23) });
  assert.deepEqual(s, ["2026-03-23T08:00:00.000Z", "2026-03-30T07:00:00.000Z"]);
});

test("localDate respecte le fuseau", () => {
  assert.equal(localDate(Date.UTC(2026, 10, 2, 23, 30), "Europe/Paris"), "2026-11-03");
});
