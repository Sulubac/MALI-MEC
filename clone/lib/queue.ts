import type { Q } from "./db.ts";

export type BookingEmailJob = {
  template: "booking_confirmation" | "booking_host_notification" | "booking_reminder" | "booking_cancelled";
  bookingId: string;
  audience: "guest" | "host";
};
export type ReconnectEmailJob = { template: "calendar_reconnect"; userId: string; audience: "host" };
export type EmailJob = BookingEmailJob | ReconnectEmailJob;

/** Ajoute un e-mail à la file. La clé d'idempotence empêche les doublons (relance d'une même action). */
export async function enqueueEmail(db: Q, job: EmailJob, opts: { runAt?: Date; key?: string } = {}): Promise<void> {
  const id = job.template === "calendar_reconnect" ? job.userId : job.bookingId;
  const key = opts.key ?? `email:${job.template}:${job.audience}:${id}`;
  await db.query(
    `insert into jobs (kind, payload, run_at, idempotency_key) values ('email', $1, $2, $3)
     on conflict (idempotency_key) do nothing`,
    [JSON.stringify(job), opts.runAt ?? new Date(), key],
  );
}

export type CalendarJob = { op: "create" | "delete"; bookingId: string };

/** Ajoute une écriture dans l'agenda de l'hôte, seulement s'il a une connexion active qui l'autorise. */
export async function enqueueCalendarWrite(db: Q, hostId: string, op: CalendarJob["op"], bookingId: string): Promise<void> {
  await db.query(
    `insert into jobs (kind, payload, idempotency_key)
     select 'calendar_write', $1, $2
     where exists (select 1 from calendar_connections where user_id = $3 and status = 'active' and write_bookings)
     on conflict (idempotency_key) do nothing`,
    [JSON.stringify({ op, bookingId } satisfies CalendarJob), `cal:${op}:${bookingId}`, hostId],
  );
}
