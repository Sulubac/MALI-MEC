import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, escapeText, foldLine } from "./ics.ts";

test("échappement : antislash, point-virgule, virgule, saut de ligne", () => {
  assert.equal(escapeText("a;b,c\\d\ne"), "a\;b\\,c\\\\d\\ne");
});

test("lignes terminées par CRLF, dont la dernière", () => {
  const s = buildIcs({ uid: "u", start: "2026-11-02T08:00:00Z", end: "2026-11-02T08:30:00Z", summary: "S", location: "" });
  assert.ok(s.startsWith("BEGIN:VCALENDAR\r\n") && s.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/[^\r]\n/.test(s), "aucun LF seul");
  assert.ok(!s.includes("LOCATION:"), "pas de lieu vide");
});

test("pliage à 75 octets sans couper un caractère, et dépliage identique à l'original", () => {
  const long = "SUMMARY:" + "é😀x".repeat(60);
  const folded = foldLine(long);
  for (const l of folded.split("\r\n")) assert.ok(Buffer.byteLength(l) <= 75, `ligne de ${Buffer.byteLength(l)} octets`);
  assert.equal(folded.replace(/\r\n /g, ""), long);
  assert.ok(!folded.includes("\uFFFD"));
});

test("un titre avec point-virgule et virgule est bien échappé dans le fichier", () => {
  const s = buildIcs({ uid: "u", start: "2026-11-02T08:00:00Z", end: "2026-11-02T08:30:00Z", summary: "Atelier; virgule, \\", location: "Salle 3, étage 2" });
  assert.ok(s.includes("SUMMARY:Atelier\; virgule\\, \\\\\r\n"));
  assert.ok(s.includes("LOCATION:Salle 3\\, étage 2\r\n"));
});
