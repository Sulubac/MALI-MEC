import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAvailability, parseEventTypeForm, parseQuestions } from "./validate.ts";

const ok = (o: Record<string, string>) => (k: string) => o[k] ?? "";
const valid = { name: "Test", duration: "30", locationKind: "video", minNotice: "240", maxDays: "60", bufferBefore: "0", bufferAfter: "10", limitPerDay: "", limitPerWeek: "", redirectUrl: "", questions: "[]" };

test("formulaire valide", () => {
  const r = parseEventTypeForm(ok(valid), () => "id");
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.value.bufferAfterMinutes, 10); assert.equal(r.value.limitPerDay, null); }
});
test("erreurs de champs", () => {
  const r = parseEventTypeForm(ok({ ...valid, name: " ", duration: "2", limitPerDay: "5", limitPerWeek: "3", redirectUrl: "http://x.io" }), () => "id");
  assert.ok(!r.ok);
  if (!r.ok) assert.deepEqual(Object.keys(r.errors).sort(), ["duration", "limitPerWeek", "name", "redirectUrl"]);
});
test("questions : liste à choix exige 2 options, 10 au plus", () => {
  assert.ok(!parseQuestions(JSON.stringify([{ label: "Choix", kind: "select", options: ["a"] }]), () => "i").ok);
  assert.ok(!parseQuestions(JSON.stringify(Array(11).fill({ label: "x", kind: "text" })), () => "i").ok);
  const r = parseQuestions(JSON.stringify([{ label: "Choix", kind: "select", options: ["a", "b"], required: true }]), () => "gen");
  assert.ok(r.ok && r.value[0].id === "gen" && r.value[0].required);
});
test("disponibilités : plusieurs plages, chevauchement refusé", () => {
  const w = [{ weekday: 1, start: "09:00", end: "12:00" }, { weekday: 1, start: "14:00", end: "17:00" }];
  assert.ok(parseAvailability(JSON.stringify(w), "[]", "Europe/Paris").ok);
  const bad = [{ weekday: 1, start: "09:00", end: "12:00" }, { weekday: 1, start: "11:00", end: "13:00" }];
  const r = parseAvailability(JSON.stringify(bad), "[]", "Europe/Paris");
  assert.ok(!r.ok && r.errors["day-1"]);
});
test("exceptions : doublon, date invalide, fuseau inconnu", () => {
  const o = [{ date: "2026-12-24", ranges: [] }, { date: "2026-12-24", ranges: [] }];
  assert.ok(!parseAvailability("[]", JSON.stringify(o), "Europe/Paris").ok);
  assert.ok(!parseAvailability("[]", JSON.stringify([{ date: "pas-une-date", ranges: [] }]), "Europe/Paris").ok);
  const r = parseAvailability("[]", "[]", "Mars/Olympus");
  assert.ok(!r.ok && r.errors.timezone);
});
