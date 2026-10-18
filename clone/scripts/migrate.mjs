// Applique db/migrations/*.sql dans l'ordre, chacune dans une transaction.
// Usage : node --env-file=.env.local scripts/migrate.mjs   (DATABASE_URL requis)
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL manquant."); process.exit(1); }

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = await readFile(join(dir, f), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations(name) values ($1)", [f]);
      await client.query("commit");
      console.log("appliquée :", f);
      applied++;
    } catch (e) {
      await client.query("rollback");
      console.error(`échec de ${f} :`, e.message);
      process.exit(1);
    }
  }
  if (!applied) console.log("base déjà à jour");
} finally {
  await client.end();
}
