// Exécution de la file de tâches : réservation par verrou de ligne, nouvelles tentatives
// avec attente croissante, et tâches « failed » conservées avec leur dernière erreur (lettres mortes).
import { query } from "./db.ts";
import { appUrl, sendEmail } from "./email.ts";
import * as T from "./email-templates.ts";
import { runCalendarJob } from "./calendar.ts";
import type { CalendarJob, EmailJob } from "./queue.ts";
import { getBookingContext } from "./store.ts";

type Job = { id: string; kind: string; payload: EmailJob | CalendarJob; attempts: number; max_attempts: number };

async function claim(): Promise<Job | null> {
  const r = await query<Job>(
    `update jobs set status = 'running', locked_at = now(), attempts = attempts + 1
     where id = (
       select id from jobs
       where (status = 'pending' and run_at <= now()) or (status = 'running' and locked_at < now() - interval '10 minutes')
       order by run_at for update skip locked limit 1
     ) returning id, kind, payload, attempts, max_attempts`);
  return r[0] ?? null;
}

/** Envoie l'e-mail d'une tâche. Renvoie « skipped » quand il n'a plus lieu d'être. */
export async function runEmailJob(p: EmailJob): Promise<"sent" | "skipped"> {
  if (p.template === "calendar_reconnect") {
    const u = await query<{ email: string }>("select email from users where id = $1", [p.userId]);
    if (!u[0]) return "skipped";
    const still = await query("select 1 from calendar_connections where user_id = $1 and status = 'revoked'", [p.userId]);
    if (!still.length) return "skipped"; // déjà reconnectée entre-temps
    await sendEmail({ to: u[0].email, ...T.calendarReconnect(appUrl("/integrations")) });
    return "sent";
  }
  const r = await query<{ manage_token: string }>("select manage_token from bookings where id = $1", [p.bookingId]);
  if (!r[0]) return "skipped"; // réservation supprimée (compte supprimé)
  const ctx = await getBookingContext(r[0].manage_token);
  if (!ctx) return "skipped";
  const c = { ...ctx, baseUrl: appUrl };
  const { booking } = ctx;
  const stillValid = booking.status === "confirmed" && Date.parse(booking.startAt) > Date.now();
  let mail: { subject: string; text: string };
  let to: string;
  switch (p.template) {
    case "booking_confirmation":
      if (booking.status !== "confirmed") return "skipped";
      mail = T.bookingConfirmation(c); to = booking.guestEmail; break;
    case "booking_host_notification": {
      if (booking.status !== "confirmed") return "skipped";
      mail = T.hostNotification(c);
      const u = await query<{ email: string }>("select email from users where id = $1", [ctx.host.id]);
      if (!u[0]) return "skipped";
      to = u[0].email; break;
    }
    case "booking_reminder":
      if (!stillValid) return "skipped";
      mail = T.bookingReminder(c); to = booking.guestEmail; break;
    case "booking_cancelled": {
      mail = T.bookingCancelled(c, p.audience);
      if (p.audience === "guest") to = booking.guestEmail;
      else {
        const u = await query<{ email: string }>("select email from users where id = $1", [ctx.host.id]);
        if (!u[0]) return "skipped";
        to = u[0].email;
      }
      break;
    }
    default:
      throw new Error(`modèle inconnu : ${(p as { template: string }).template}`);
  }
  await sendEmail({ to, ...mail });
  return "sent";
}

export async function processDueJobs(limit = 25): Promise<{ done: number; retried: number; failed: number }> {
  const out = { done: 0, retried: 0, failed: 0 };
  for (let i = 0; i < limit; i++) {
    const job = await claim();
    if (!job) break;
    try {
      if (job.kind === "email") await runEmailJob(job.payload as EmailJob);
      else if (job.kind === "calendar_write") await runCalendarJob(job.payload as CalendarJob);
      else throw new Error(`type de tâche non géré : ${job.kind}`);
      await query("update jobs set status = 'done', finished_at = now(), last_error = null where id = $1", [job.id]);
      out.done++;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 1000);
      if (job.attempts >= job.max_attempts) {
        await query("update jobs set status = 'failed', finished_at = now(), last_error = $2 where id = $1", [job.id, msg]);
        out.failed++;
      } else {
        // 2, 4, 8, 16 minutes
        await query("update jobs set status = 'pending', last_error = $2, run_at = now() + make_interval(mins => $3) where id = $1", [job.id, msg, 2 ** job.attempts]);
        out.retried++;
      }
    }
  }
  return out;
}
