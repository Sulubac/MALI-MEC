// Chiffrement des secrets stockés en base (jetons d'accès aux agendas). AES-256-GCM, clé dans TOKEN_ENCRYPTION_KEY.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(env = process.env): Buffer {
  const raw = env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY manquant (32 octets en base64 : openssl rand -base64 32)");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY doit faire 32 octets une fois décodée de base64");
  return k;
}

/** `aad` lie le chiffré à son propriétaire : copié sur la ligne d'un autre utilisateur, il ne se déchiffre plus. */
export function encryptSecret(plain: string, aad: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), ct.toString("base64url"), c.getAuthTag().toString("base64url")].join(".");
}

export function decryptSecret(blob: string, aad: string): string {
  const [v, iv, ct, tag] = blob.split(".");
  if (v !== "v1" || !iv || !ct || !tag) throw new Error("secret chiffré illisible");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
