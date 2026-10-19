import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAvailability, parseEventTypeForm, parseQuestions, parseSignup, suggestUsername, validatePassword } from "./validate.ts";

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

const signup = { email: "a@example.com", password: "un-mot-de-passe-solide", username: "alice", displayName: "Alice", timezone: "Europe/Paris" };
test("inscription valide, fuseau inconnu ramené à UTC", () => {
  const r = parseSignup(ok({ ...signup, timezone: "Mars/Olympus" }));
  assert.ok(r.ok && r.value.timezone === "UTC");
});
test("inscription : erreurs de champs et noms réservés", () => {
  const r = parseSignup(ok({ ...signup, email: "pas-un-email", password: "court", username: "Login", displayName: " " }));
  assert.ok(!r.ok);
  if (!r.ok) assert.deepEqual(Object.keys(r.errors).sort(), ["displayName", "email", "password", "username"]);
  assert.ok(!parseSignup(ok({ ...signup, username: "account" })).ok);
  assert.ok(!parseSignup(ok({ ...signup, username: "a b" })).ok);
});
test("mot de passe : longueur et répétitions", () => {
  assert.ok(validatePassword("123456789") !== null);
  assert.ok(validatePassword("aaaaaaaaaaaa") !== null);
  assert.equal(validatePassword("une phrase de passe correcte"), null);
  assert.ok(validatePassword("x".repeat(129)) !== null);
});

test("suggestion de nom public : minuscules, accents retirés, tirets, jamais réservé, longueurs valides", () => {
  assert.equal(suggestUsername("Alex.Martin@example.com"), "alex-martin");
  assert.equal(suggestUsername("éloïse_zoë@example.com"), "eloise-zoe");
  assert.equal(suggestUsername("account@example.com"), "account-1");      // réservé
  assert.equal(suggestUsername("ab@example.com"), "ab-rdv");              // trop court
  assert.equal(suggestUsername("@example.com", "Camille Durand"), "camille-durand");
  assert.equal(suggestUsername("!!!@example.com"), "utilisateur");
  assert.ok(suggestUsername(`${"a".repeat(80)}@example.com`).length <= 40);
  for (const e of ["a@b.c", "x.y.z@d.e", "123@d.e", "login@d.e", "--@d.e"]) assert.match(suggestUsername(e), /^[a-z0-9-]{3,40}$/, e);
});

