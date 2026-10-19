import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "./crypto.ts";

process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

test("aller-retour, chiffré différent à chaque fois, jamais en clair", () => {
  const a = encryptSecret("1//refresh-secret", "user-1"), b = encryptSecret("1//refresh-secret", "user-1");
  assert.notEqual(a, b);
  assert.ok(!a.includes("refresh-secret"));
  assert.equal(decryptSecret(a, "user-1"), "1//refresh-secret");
});

test("lié à son propriétaire : un autre identifiant, un chiffré modifié ou une autre clé échouent", () => {
  const a = encryptSecret("jeton", "user-1");
  assert.throws(() => decryptSecret(a, "user-2"));
  const parts = a.split("."); parts[2] = Buffer.from("x" + Buffer.from(parts[2], "base64url").toString("latin1").slice(1), "latin1").toString("base64url");
  assert.throws(() => decryptSecret(parts.join("."), "user-1"));
  const old = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  assert.throws(() => decryptSecret(a, "user-1"));
  process.env.TOKEN_ENCRYPTION_KEY = old;
});

test("clé absente ou de mauvaise taille : erreur explicite", () => {
  const old = process.env.TOKEN_ENCRYPTION_KEY;
  delete process.env.TOKEN_ENCRYPTION_KEY;
  assert.throws(() => encryptSecret("x", "u"), /TOKEN_ENCRYPTION_KEY manquant/);
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.from("trop-court").toString("base64");
  assert.throws(() => encryptSecret("x", "u"), /32 octets/);
  process.env.TOKEN_ENCRYPTION_KEY = old;
});
