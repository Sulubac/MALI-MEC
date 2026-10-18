// Données de démonstration (personnes fictives). Refuse de tourner en production.
// Usage : node --experimental-strip-types --env-file-if-exists=.env.local scripts/seed.mjs
import { signUp, verifyEmail } from "../lib/auth-core.ts";
import { closePool, query } from "../lib/db.ts";
import { createEventType, getHostByUsername } from "../lib/store.ts";

if (process.env.NODE_ENV === "production") { console.error("Refus : seed interdit en production."); process.exit(1); }

const email = "demo@example.test";
const password = process.env.SEED_PASSWORD ?? "demo-demo-demo-1";

if ((await query("select 1 from users where lower(email) = $1", [email])).length) {
  console.log("Déjà présent :", email);
} else {
  const r = await signUp({ email, password, username: "demo", displayName: "Alex Martin", timezone: "Europe/Paris" });
  if (r.status !== "created") throw new Error(`inscription : ${r.status}`);
  await verifyEmail(r.token);
  const host = await getHostByUsername("demo");
  const base = { locationKind: "video", locationDetail: "", minNoticeMinutes: 240, maxDaysAhead: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, limitPerDay: null, limitPerWeek: null, questions: [], confirmationRedirectUrl: "" };
  await createEventType(host.id, { ...base, name: "Échange de 30 minutes", description: "Un premier tour d'horizon, sans engagement.", durationMinutes: 30,
    questions: [{ id: "q-sujet", label: "De quoi souhaitez-vous parler ?", kind: "textarea", options: [], required: false }] });
  await createEventType(host.id, { ...base, name: "Atelier de travail d'une heure", description: "Une heure pour avancer sur un sujet précis.", durationMinutes: 60, bufferAfterMinutes: 15 });
  console.log(`Compte de démonstration créé : ${email} / ${password}`);
}
await closePool();
