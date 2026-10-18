import { timingSafeEqual } from "node:crypto";
import { cleanupExpired } from "@/lib/auth-core";
import { processDueJobs } from "@/lib/worker";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Appelée chaque minute par le planificateur (Vercel Cron, cron système…) : envoie les rappels dus, relance les échecs, nettoie. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET non configuré" }, { status: 503 });
  if (!authorized(req)) return Response.json({ error: "non autorisé" }, { status: 401 });
  const jobs = await processDueJobs(100);
  const cleaned = await cleanupExpired();
  return Response.json({ jobs, cleaned });
}
