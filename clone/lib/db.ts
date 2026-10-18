import pg from "pg";

// Les colonnes `date` ne doivent pas être converties en Date locale (on les manipule en "YYYY-MM-DD").
pg.types.setTypeParser(1082, (v: string) => v);

const g = globalThis as unknown as { __pool?: pg.Pool };

export function pool(): pg.Pool {
  if (!g.__pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL manquant");
    g.__pool = new pg.Pool({ connectionString: url, max: 10 });
  }
  return g.__pool;
}

export type Q = Pick<pg.PoolClient, "query">;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool().query<T>(text, params)).rows;
}

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export const isUniqueViolation = (e: unknown, constraint?: string) =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "23505" &&
  (!constraint || (e as { constraint?: string }).constraint === constraint);

export const isExclusionViolation = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "23P01";

export async function closePool() {
  await g.__pool?.end();
  g.__pool = undefined;
}
