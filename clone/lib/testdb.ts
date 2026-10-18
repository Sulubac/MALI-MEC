// Aide pour les tests qui ont besoin de Postgres : TEST_DATABASE_URL doit pointer vers une base migrée.
// Sans elle, ces tests sont ignorés (et le dit).
export const TEST_URL = process.env.TEST_DATABASE_URL;
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;
process.env.EMAIL_TRANSPORT = "outbox";
process.env.APP_URL = "http://app.test";

export const skip = TEST_URL ? false : "TEST_DATABASE_URL non défini : tests Postgres ignorés";

export async function resetDb() {
  const { query } = await import("./db.ts");
  await query("truncate users, jobs, rate_limits, email_outbox cascade");
}
