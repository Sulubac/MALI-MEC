// Couche de données Postgres. Chaque fonction qui touche aux données d'un compte reçoit
// l'identifiant du propriétaire et le met dans sa requête : c'est le contrôle d'accès.
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { computeSlots, type Override, type Rule } from "./availability.ts";
import { isExclusionViolation, isUniqueViolation, pool, query, tx, type Q } from "./db.ts";
import { enqueueEmail } from "./queue.ts";
import {
  SlotTakenError, SlotUnavailableError,
  type Booking, type EventType, type EventTypeInput, type Host, type Question,
} from "./types.ts";

const iso = (d: Date | string) => new Date(d).toISOString();
const hhmm = (t: string) => t.slice(0, 5);

/** Exécuteur de requêtes sur le pool, utilisable comme `Q` à la place d'un client de transaction. */
const poolQ: Q = { query: ((...a: unknown[]) => (pool().query as (...x: unknown[]) => unknown)(...a)) as Q["query"] };

// ---------- Profils ----------
type HostRow = { id: string; username: string; display_name: string; timezone: string };
const toHost = (r: HostRow): Host => ({ id: r.id, username: r.username, displayName: r.display_name, timezone: r.timezone });

export async function getHostById(id: string): Promise<Host | null> {
  const r = await query<HostRow>("select id, username, display_name, timezone from profiles where id = $1", [id]);
  return r[0] ? toHost(r[0]) : null;
}
export async function getHostByUsername(username: string): Promise<Host | null> {
  const r = await query<HostRow>("select id, username, display_name, timezone from profiles where username = $1", [username]);
  return r[0] ? toHost(r[0]) : null;
}

// ---------- Types d'événements ----------
type EtRow = {
  id: string; owner_id: string; slug: string; name: string; color: string; description: string; duration_minutes: number;
  location_kind: EventType["locationKind"]; location_detail: string; active: boolean; min_notice_minutes: number;
  max_days_ahead: number; buffer_before_minutes: number; buffer_after_minutes: number; limit_per_day: number | null;
  limit_per_week: number | null; slot_step_minutes: number; questions: Question[]; confirmation_redirect_url: string;
};
const ET_COLS = `id, owner_id, slug, name, color, description, duration_minutes, location_kind, location_detail, active,
  min_notice_minutes, max_days_ahead, buffer_before_minutes, buffer_after_minutes, limit_per_day, limit_per_week,
  slot_step_minutes, questions, confirmation_redirect_url`;
const toEt = (r: EtRow): EventType => ({
  id: r.id, ownerId: r.owner_id, slug: r.slug, name: r.name, color: r.color, description: r.description,
  durationMinutes: r.duration_minutes, locationKind: r.location_kind, locationDetail: r.location_detail, active: r.active,
  minNoticeMinutes: r.min_notice_minutes, maxDaysAhead: r.max_days_ahead, bufferBeforeMinutes: r.buffer_before_minutes,
  bufferAfterMinutes: r.buffer_after_minutes, limitPerDay: r.limit_per_day, limitPerWeek: r.limit_per_week,
  stepMinutes: r.slot_step_minutes, questions: r.questions, confirmationRedirectUrl: r.confirmation_redirect_url,
});

export async function listEventTypes(ownerId: string, opts: { activeOnly?: boolean } = {}): Promise<EventType[]> {
  const r = await query<EtRow>(
    `select ${ET_COLS} from event_types where owner_id = $1 ${opts.activeOnly ? "and active" : ""} order by created_at, id`, [ownerId]);
  return r.map(toEt);
}
export async function getEventTypeBySlug(ownerId: string, slug: string): Promise<EventType | null> {
  const r = await query<EtRow>(`select ${ET_COLS} from event_types where owner_id = $1 and slug = $2`, [ownerId, slug]);
  return r[0] ? toEt(r[0]) : null;
}
export async function getOwnedEventType(ownerId: string, id: string): Promise<EventType | null> {
  const r = await query<EtRow>(`select ${ET_COLS} from event_types where owner_id = $1 and id = $2`, [ownerId, id]);
  return r[0] ? toEt(r[0]) : null;
}

export function slugify(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

const ET_VALUES = (i: EventTypeInput) => [
  i.name, i.description, i.durationMinutes, i.locationKind, i.locationDetail, i.minNoticeMinutes, i.maxDaysAhead,
  i.bufferBeforeMinutes, i.bufferAfterMinutes, i.limitPerDay, i.limitPerWeek, JSON.stringify(i.questions), i.confirmationRedirectUrl,
];

export async function createEventType(ownerId: string, input: EventTypeInput): Promise<EventType> {
  let root = slugify(input.name);
  if (root.length < 2) root = "evenement";
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? root : `${root}-${n}`.slice(0, 60);
    try {
      const r = await query<EtRow>(
        `insert into event_types (owner_id, slug, name, description, duration_minutes, location_kind, location_detail,
           min_notice_minutes, max_days_ahead, buffer_before_minutes, buffer_after_minutes, limit_per_day, limit_per_week,
           questions, confirmation_redirect_url)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) returning ${ET_COLS}`,
        [ownerId, slug, ...ET_VALUES(input)]);
      return toEt(r[0]);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // lien déjà pris : on essaie le suivant
    }
  }
  throw new Error("Impossible de générer un lien unique");
}

/** Le lien (slug) ne change pas : les liens déjà partagés restent valables. */
export async function updateEventType(ownerId: string, id: string, input: EventTypeInput): Promise<EventType | null> {
  const r = await query<EtRow>(
    `update event_types set name=$3, description=$4, duration_minutes=$5, location_kind=$6, location_detail=$7,
       min_notice_minutes=$8, max_days_ahead=$9, buffer_before_minutes=$10, buffer_after_minutes=$11,
       limit_per_day=$12, limit_per_week=$13, questions=$14, confirmation_redirect_url=$15
     where owner_id = $1 and id = $2 returning ${ET_COLS}`,
    [ownerId, id, ...ET_VALUES(input)]);
  return r[0] ? toEt(r[0]) : null;
}

/** Refuse s'il existe des réservations : il faut alors désactiver le type. */
export async function deleteEventType(ownerId: string, id: string): Promise<"deleted" | "has_bookings" | "not_found"> {
  return tx(async (c) => {
    const own = await c.query("select 1 from event_types where owner_id = $1 and id = $2 for update", [ownerId, id]);
    if (!own.rowCount) return "not_found";
    const used = await c.query("select 1 from bookings where event_type_id = $1 limit 1", [id]);
    if (used.rowCount) return "has_bookings";
    await c.query("delete from event_types where id = $1", [id]);
    return "deleted";
  });
}

export async function setEventTypeActive(ownerId: string, id: string, active: boolean): Promise<void> {
  await query("update event_types set active = $3 where owner_id = $1 and id = $2", [ownerId, id, active]);
}

// ---------- Disponibilités ----------
export async function getRules(ownerId: string, db: Q = poolQ): Promise<Rule[]> {
  const r = await db.query("select weekday, start_time, end_time from availability_rules where user_id = $1 order by weekday, start_time", [ownerId]);
  return r.rows.map((x: { weekday: number; start_time: string; end_time: string }) => ({ weekday: x.weekday, start: hhmm(x.start_time), end: hhmm(x.end_time) }));
}
export async function getOverrides(ownerId: string, db: Q = poolQ): Promise<Override[]> {
  const r = await db.query("select on_date, start_time, end_time from availability_overrides where user_id = $1 order by on_date, start_time", [ownerId]);
  const by = new Map<string, Override>();
  for (const x of r.rows as { on_date: string; start_time: string | null; end_time: string | null }[]) {
    const o = by.get(x.on_date) ?? { date: x.on_date, ranges: [] };
    if (x.start_time && x.end_time) o.ranges.push({ start: hhmm(x.start_time), end: hhmm(x.end_time) });
    by.set(x.on_date, o);
  }
  return [...by.values()];
}


export async function saveAvailability(ownerId: string, rules: Rule[], overrides: Override[], timezone: string): Promise<void> {
  await tx(async (c) => {
    await c.query("delete from availability_rules where user_id = $1", [ownerId]);
    for (const r of rules) await c.query("insert into availability_rules (user_id, weekday, start_time, end_time) values ($1,$2,$3,$4)", [ownerId, r.weekday, r.start, r.end]);
    await c.query("delete from availability_overrides where user_id = $1", [ownerId]);
    for (const o of overrides) {
      if (o.ranges.length === 0) await c.query("insert into availability_overrides (user_id, on_date) values ($1,$2)", [ownerId, o.date]);
      for (const g of o.ranges) await c.query("insert into availability_overrides (user_id, on_date, start_time, end_time) values ($1,$2,$3,$4)", [ownerId, o.date, g.start, g.end]);
    }
    await c.query("update profiles set timezone = $2 where id = $1", [ownerId, timezone]);
  });
}

// ---------- Réservations ----------
type BkRow = {
  id: string; event_type_id: string; host_id: string; start_at: Date; end_at: Date; guest_name: string; guest_email: string;
  guest_timezone: string; answers: Record<string, string>; status: Booking["status"]; cancel_reason: string | null;
  cancelled_by: Booking["cancelledBy"]; manage_token: string;
};
const BK_COLS = "id, event_type_id, host_id, start_at, end_at, guest_name, guest_email, guest_timezone, answers, status, cancel_reason, cancelled_by, manage_token";
const toBk = (r: BkRow): Booking => ({
  id: r.id, eventTypeId: r.event_type_id, hostId: r.host_id, startAt: iso(r.start_at), endAt: iso(r.end_at),
  guestName: r.guest_name, guestEmail: r.guest_email, guestTimezone: r.guest_timezone, answers: r.answers,
  status: r.status, cancelReason: r.cancel_reason, cancelledBy: r.cancelled_by, manageToken: r.manage_token,
});

export async function listBookings(hostId: string): Promise<Booking[]> {
  const r = await query<BkRow>(`select ${BK_COLS} from bookings where host_id = $1 order by start_at`, [hostId]);
  return r.map(toBk);
}

/** Le jeton de gestion est un secret partagé avec l'invité : il tient lieu d'autorisation. */
export async function getBookingContext(token: string): Promise<{ booking: Booking; eventType: EventType; host: Host } | null> {
  const r = await query<BkRow>(`select ${BK_COLS} from bookings where manage_token = $1`, [token]);
  if (!r[0]) return null;
  const booking = toBk(r[0]);
  const [host, et] = await Promise.all([
    getHostById(booking.hostId),
    query<EtRow>(`select ${ET_COLS} from event_types where id = $1`, [booking.eventTypeId]),
  ]);
  if (!host || !et[0]) return null;
  return { booking, eventType: toEt(et[0]), host };
}

async function slotsWith(db: Q, host: Host, et: EventType, now: number): Promise<string[]> {
  const busyRows = await db.query(
    `select start_at, end_at from bookings where host_id = $1 and status = 'confirmed' and end_at >= $2`,
    [host.id, new Date(now - 8 * 24 * 3600_000)]);
  const busy = busyRows.rows.map((b: { start_at: Date; end_at: Date }) => ({ start: b.start_at.getTime(), end: b.end_at.getTime() }));
  return computeSlots({
    rules: await getRules(host.id, db), overrides: await getOverrides(host.id, db), hostTz: host.timezone, busy, now,
    slot: {
      durationMinutes: et.durationMinutes, stepMinutes: et.stepMinutes, minNoticeMinutes: et.minNoticeMinutes,
      maxDaysAhead: et.maxDaysAhead, bufferBeforeMinutes: et.bufferBeforeMinutes, bufferAfterMinutes: et.bufferAfterMinutes,
      limitPerDay: et.limitPerDay, limitPerWeek: et.limitPerWeek,
    },
  });
}

export function listSlots(host: Host, et: EventType, now = Date.now()): Promise<string[]> {
  return slotsWith(poolQ, host, et, now);
}

/**
 * Vérifie puis insère dans une transaction. Le verrou par hôte sérialise les réservations concurrentes
 * (les limites par jour/semaine restent exactes) ; la contrainte d'exclusion reste l'arbitre final
 * du chevauchement.
 */
export async function createBooking(
  host: Host, et: EventType,
  input: { startAt: string; guestName: string; guestEmail: string; guestTimezone: string; answers?: Record<string, string>; rescheduleToken?: string },
  now = Date.now(),
): Promise<Booking> {
  const start = Date.parse(input.startAt);
  try {
    return await tx(async (c: PoolClient) => {
      await c.query("select pg_advisory_xact_lock(hashtext($1))", [host.id]);
      const slots = await slotsWith(c, host, et, now);
      if (!slots.includes(new Date(start).toISOString())) {
        const clash = await c.query(
          "select 1 from bookings where host_id = $1 and status = 'confirmed' and tstzrange(start_at, end_at) && tstzrange($2, $3)",
          [host.id, new Date(start), new Date(start + et.durationMinutes * 60_000)]);
        throw clash.rowCount ? new SlotTakenError() : new SlotUnavailableError();
      }
      let previousId: string | null = null;
      if (input.rescheduleToken) {
        const old = await c.query(
          "select id from bookings where manage_token = $1 and host_id = $2 and status = 'confirmed' and lower(guest_email) = lower($3) for update",
          [input.rescheduleToken, host.id, input.guestEmail]);
        previousId = old.rows[0]?.id ?? null;
        if (previousId) await c.query("update bookings set status='cancelled', cancelled_by='guest', cancel_reason=$2 where id = $1", [previousId, "Remplacé par un nouveau créneau"]);
      }
      const r = await c.query<BkRow>(
        `insert into bookings (event_type_id, host_id, start_at, end_at, guest_name, guest_email, guest_timezone, answers, rescheduled_from)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning ${BK_COLS}`,
        [et.id, host.id, new Date(start), new Date(start + et.durationMinutes * 60_000), input.guestName, input.guestEmail,
         input.guestTimezone, JSON.stringify(input.answers ?? {}), previousId]);
      const b = toBk(r.rows[0]);
      await enqueueEmail(c, { template: "booking_confirmation", bookingId: b.id, audience: "guest" });
      await enqueueEmail(c, { template: "booking_host_notification", bookingId: b.id, audience: "host" });
      const remindAt = new Date(start - 24 * 3600_000);
      if (remindAt.getTime() > now) await enqueueEmail(c, { template: "booking_reminder", bookingId: b.id, audience: "guest" }, { runAt: remindAt });
      return b;
    });
  } catch (e) {
    if (isExclusionViolation(e)) throw new SlotTakenError();
    throw e;
  }
}

/** Annule une réservation confirmée. `by: "host"` exige que `actorId` soit l'hôte ; l'invité s'authentifie par son jeton. */
export async function cancelBooking(token: string, by: "host" | "guest", reason: string, actorId?: string): Promise<Booking | null> {
  return tx(async (c) => {
    const r = await c.query<BkRow>(`select ${BK_COLS} from bookings where manage_token = $1 for update`, [token]);
    if (!r.rows[0]) return null;
    const b = toBk(r.rows[0]);
    if (by === "host" && b.hostId !== actorId) return null;
    if (b.status === "cancelled") return b;
    const u = await c.query<BkRow>(
      `update bookings set status='cancelled', cancelled_by=$2, cancel_reason=$3 where id = $1 returning ${BK_COLS}`,
      [b.id, by, reason || null]);
    await enqueueEmail(c, { template: "booking_cancelled", bookingId: b.id, audience: "guest" });
    await enqueueEmail(c, { template: "booking_cancelled", bookingId: b.id, audience: "host" });
    return toBk(u.rows[0]);
  });
}

export const newId = () => randomUUID();
