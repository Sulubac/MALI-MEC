import { execFileSync } from "node:child_process";
import pg from "pg";

export default async function globalSetup() {
  const url = process.env.DATABASE_URL!;
  if (!/e2e|test/.test(url)) throw new Error("Refus : l'URL de base ne contient ni « e2e » ni « test ».");
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query("truncate users, jobs, rate_limits, email_outbox cascade");
  await c.end();
  execFileSync("node", ["--experimental-strip-types", "--no-warnings", "scripts/seed.mjs"], { env: process.env, stdio: "inherit" });
}
