import { query } from "./db.ts";

export type Mail = { to: string; subject: string; text: string };

type Transport = "resend" | "outbox" | "none";

/**
 * Choix du transport :
 *   EMAIL_TRANSPORT explicite, sinon Resend si RESEND_API_KEY existe,
 *   sinon « outbox » (table email_outbox) hors production, et refus en production.
 */
export function transport(env = process.env): Transport {
  const forced = env.EMAIL_TRANSPORT;
  if (forced === "resend" || forced === "outbox" || forced === "none") return forced;
  if (env.RESEND_API_KEY) return "resend";
  return env.NODE_ENV === "production" ? "none" : "outbox";
}

export async function sendEmail(mail: Mail): Promise<void> {
  const t = transport();
  if (t === "outbox") {
    await query("insert into email_outbox (to_address, subject, body_text) values ($1,$2,$3)", [mail.to, mail.subject, mail.text]);
    return;
  }
  if (t === "none") throw new Error("Aucun fournisseur d'e-mail configuré (RESEND_API_KEY et EMAIL_FROM)");
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("RESEND_API_KEY et EMAIL_FROM sont requis");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status} : ${(await res.text()).slice(0, 300)}`);
}

export function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}
