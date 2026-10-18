// Couche de données simulée (en mémoire). Les signatures sont celles que
// replica-backend remplacera par Postgres : les écrans n'appellent que ces fonctions.
import { randomBytes, randomUUID } from "node:crypto";
import { computeSlots, type Override, type Rule } from "./availability.ts";
import { SlotTakenError, SlotUnavailableError, type Booking, type EventType, type EventTypeInput, type Host } from "./types.ts";

type DB = { hosts: Host[]; eventTypes: EventType[]; rules: Record<string, Rule[]>; overrides: Record<string, Override[]>; bookings: Booking[] };

const HOST_ID = "host-demo";

function seed(): DB {
  const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "09:00", end: "17:00" }));
  const base = {
    ownerId: HOST_ID, description: "", locationKind: "video" as const, locationDetail: "", active: true,
    minNoticeMinutes: 240, maxDaysAhead: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 0,
    limitPerDay: null, limitPerWeek: null, stepMinutes: 30, questions: [], confirmationRedirectUrl: "",
  };
  return {
    hosts: [{ id: HOST_ID, username: "demo", displayName: "Alex Martin", timezone: "Europe/Paris" }],
    eventTypes: [
      { ...base, id: "et-1", slug: "echange-30", name: "Échange de 30 minutes", color: "var(--color-accent)", durationMinutes: 30,
        description: "Un premier tour d'horizon, sans engagement.",
        questions: [{ id: "q-sujet", label: "De quoi souhaitez-vous parler ?", kind: "textarea" as const, options: [], required: false }] },
      { ...base, id: "et-2", slug: "atelier-60", name: "Atelier de travail d'une heure", color: "var(--color-success)", durationMinutes: 60,
        bufferAfterMinutes: 15, description: "Une heure pour avancer sur un sujet précis." },
      { ...base, id: "et-3", slug: "point-rapide", name: "Point rapide", color: "var(--color-warning)", durationMinutes: 15, active: false },
    ],
    rules: { [HOST_ID]: weekdays },
    overrides: {},
    bookings: [],
  };
}

const g = globalThis as unknown as { __db?: DB };
const db = (): DB => (g.__db ??= seed());

export function getCurrentHost(): Host {
  return db().hosts[0];
}
export function getHostByUsername(username: string): Host | null {
  return db().hosts.find((h) => h.username === username) ?? null;
}

export function listEventTypes(ownerId: string, opts: { activeOnly?: boolean } = {}): EventType[] {
  return db().eventTypes.filter((e) => e.ownerId === ownerId && (!opts.activeOnly || e.active));
}
export function getEventTypeBySlug(ownerId: string, slug: string): EventType | null {
  return db().eventTypes.find((e) => e.ownerId === ownerId && e.slug === slug) ?? null;
}

export function slugify(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function createEventType(ownerId: string, input: EventTypeInput & { color?: string }): EventType {
  const d = db();
  let slug = slugify(input.name) || "evenement";
  const root = slug;
  for (let i = 2; d.eventTypes.some((e) => e.ownerId === ownerId && e.slug === slug); i++) slug = `${root}-${i}`;
  const et: EventType = { color: "var(--color-accent)", stepMinutes: 30, ...input, ownerId, id: randomUUID(), slug, active: true };
  d.eventTypes.push(et);
  return et;
}

export function getEventTypeById(id: string): EventType | null {
  return db().eventTypes.find((e) => e.id === id) ?? null;
}

/** Le lien (slug) ne change pas : les liens déjà partagés restent valables. */
export function updateEventType(ownerId: string, id: string, input: EventTypeInput): EventType | null {
  const et = db().eventTypes.find((e) => e.id === id && e.ownerId === ownerId);
  if (!et) return null;
  Object.assign(et, input);
  return et;
}

/** Refuse si des réservations existent (comme `on delete restrict` en base) : il faut alors désactiver le type. */
export function deleteEventType(ownerId: string, id: string): "deleted" | "has_bookings" | "not_found" {
  const d = db();
  const idx = d.eventTypes.findIndex((e) => e.id === id && e.ownerId === ownerId);
  if (idx < 0) return "not_found";
  if (d.bookings.some((b) => b.eventTypeId === id)) return "has_bookings";
  d.eventTypes.splice(idx, 1);
  return "deleted";
}

export function setEventTypeActive(ownerId: string, id: string, active: boolean): void {
  const et = db().eventTypes.find((e) => e.id === id && e.ownerId === ownerId);
  if (et) et.active = active;
}

export function getRules(ownerId: string): Rule[] {
  return db().rules[ownerId] ?? [];
}
export function setRules(ownerId: string, rules: Rule[]): void {
  db().rules[ownerId] = rules;
}

export function getOverrides(ownerId: string): Override[] {
  return db().overrides[ownerId] ?? [];
}
export function setOverrides(ownerId: string, overrides: Override[]): void {
  db().overrides[ownerId] = overrides;
}
export function setHostTimezone(hostId: string, timezone: string): void {
  const h = db().hosts.find((x) => x.id === hostId);
  if (h) h.timezone = timezone;
}

export function listBookings(hostId: string): Booking[] {
  return db().bookings.filter((b) => b.hostId === hostId).sort((a, b) => a.startAt.localeCompare(b.startAt));
}
export function getBookingByToken(token: string): Booking | null {
  return db().bookings.find((b) => b.manageToken === token) ?? null;
}

export function listSlots(host: Host, et: EventType, now = Date.now()): string[] {
  const busy = db().bookings
    .filter((b) => b.hostId === host.id && b.status === "confirmed")
    .map((b) => ({ start: Date.parse(b.startAt), end: Date.parse(b.endAt) }));
  return computeSlots({
    rules: getRules(host.id), overrides: getOverrides(host.id), hostTz: host.timezone, busy, now,
    slot: {
      durationMinutes: et.durationMinutes, stepMinutes: et.stepMinutes, minNoticeMinutes: et.minNoticeMinutes,
      maxDaysAhead: et.maxDaysAhead, bufferBeforeMinutes: et.bufferBeforeMinutes,
      bufferAfterMinutes: et.bufferAfterMinutes, limitPerDay: et.limitPerDay, limitPerWeek: et.limitPerWeek,
    },
  });
}

/** Vérifie puis insère sans point d'attente entre les deux (équivalent de la contrainte d'exclusion Postgres). */
export function createBooking(host: Host, et: EventType, input: { startAt: string; guestName: string; guestEmail: string; guestTimezone: string; answers?: Record<string, string> }): Booking {
  const d = db();
  if (!listSlots(host, et).includes(new Date(input.startAt).toISOString())) {
    const start = Date.parse(input.startAt);
    const overlapping = d.bookings.some((b) => b.hostId === host.id && b.status === "confirmed" &&
      start < Date.parse(b.endAt) && start + et.durationMinutes * 60_000 > Date.parse(b.startAt));
    throw overlapping ? new SlotTakenError() : new SlotUnavailableError();
  }
  const start = Date.parse(input.startAt);
  const b: Booking = {
    id: randomUUID(), eventTypeId: et.id, hostId: host.id,
    startAt: new Date(start).toISOString(), endAt: new Date(start + et.durationMinutes * 60_000).toISOString(),
    guestName: input.guestName, guestEmail: input.guestEmail, guestTimezone: input.guestTimezone, answers: input.answers ?? {},
    status: "confirmed", cancelReason: null, cancelledBy: null, manageToken: randomBytes(24).toString("hex"),
  };
  d.bookings.push(b);
  return b;
}

export function cancelBooking(token: string, by: "host" | "guest", reason: string): Booking | null {
  const b = getBookingByToken(token);
  if (!b || b.status === "cancelled") return b;
  b.status = "cancelled";
  b.cancelledBy = by;
  b.cancelReason = reason || null;
  return b;
}
