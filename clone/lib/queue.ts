import type { Q } from "./db.ts";

export type EmailJob = {
  template: "booking_confirmation" | "booking_host_notification" | "booking_reminder" | "booking_cancelled";
  bookingId: string;
  audience: "guest" | "host";
};

/** Ajoute un e-mail à la file. La clé d'idempotence empêche les doublons (relance d'une même action). */
export async function enqueueEmail(db: Q, job: EmailJob, opts: { runAt?: Date; key?: string } = {}): Promise<void> {
  const key = opts.key ?? `email:${job.template}:${job.audience}:${job.bookingId}`;
  await db.query(
    `insert into jobs (kind, payload, run_at, idempotency_key) values ('email', $1, $2, $3)
     on conflict (idempotency_key) do nothing`,
    [JSON.stringify(job), opts.runAt ?? new Date(), key],
  );
}
