import { query } from "./db.ts";

/**
 * Fenêtre fixe, compteur en base (partagé entre instances).
 * Renvoie ok=false quand la clé a dépassé `max` appels dans la fenêtre de `windowSeconds`.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<{ ok: boolean; count: number }> {
  const r = await query<{ count: number }>(
    `insert into rate_limits (key, window_start, count)
     values ($1, to_timestamp(floor(extract(epoch from now()) / $2) * $2), 1)
     on conflict (key, window_start) do update set count = rate_limits.count + 1
     returning count`,
    [key, windowSeconds],
  );
  return { ok: r[0].count <= max, count: r[0].count };
}
