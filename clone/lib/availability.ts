// Calcul des créneaux : fonction pure, sans accès base. Tout en UTC (ms) ;
// les règles sont en heure locale de l'hôte et converties jour par jour,
// jamais en ajoutant 24 h (heure d'été).

export type Rule = { weekday: number; start: string; end: string }; // weekday 0 = dimanche, "HH:MM"
export type Busy = { start: number; end: number };
/** Exception pour une date locale de l'hôte : remplace les plages hebdomadaires ; aucune plage = indisponible. */
export type Override = { date: string; ranges: { start: string; end: string }[] };

export type SlotRules = {
  durationMinutes: number;
  stepMinutes: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  limitPerDay: number | null;
  limitPerWeek: number | null;
};

const MIN = 60_000;

function parts(ms: number, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ss: +p.second };
}

function offsetMs(ms: number, tz: string): number {
  const p = parts(ms, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - Math.floor(ms / 1000) * 1000;
}

/** Date locale "YYYY-MM-DD" d'un instant dans un fuseau. */
export function localDate(ms: number, tz: string): string {
  const p = parts(ms, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Heure locale → instant UTC, ou null si cette heure n'existe pas (trou d'heure d'été). */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): number | null {
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let t = wall - offsetMs(wall, tz);
  t = wall - offsetMs(t, tz);
  const back = parts(t, tz);
  if (back.y !== y || back.m !== m || back.d !== d || back.hh !== hh || back.mm !== mm) return null;
  return t;
}

/** Lundi de la semaine d'une date "YYYY-MM-DD" (clé de semaine). */
export function mondayKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  const mon = new Date(Date.UTC(y, m - 1, d - dow));
  return `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, "0")}-${String(mon.getUTCDate()).padStart(2, "0")}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function computeSlots(args: {
  rules: Rule[];
  hostTz: string;
  slot: SlotRules;
  busy: Busy[];
  now: number;
  overrides?: Override[];
}): string[] {
  const { rules, hostTz, slot, busy, now, overrides = [] } = args;
  const out: string[] = [];
  const earliest = now + slot.minNoticeMinutes * MIN;
  const latest = now + slot.maxDaysAhead * 24 * 60 * MIN;
  const dur = slot.durationMinutes * MIN;
  const before = slot.bufferBeforeMinutes * MIN;
  const after = slot.bufferAfterMinutes * MIN;

  const today = parts(now, hostTz);
  for (let i = 0; i <= slot.maxDaysAhead + 1; i++) {
    // Jour calendaire de l'hôte (arithmétique sur la date seule, pas sur des instants)
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate();
    const weekday = day.getUTCDay();
    const dateKey = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    if (slot.limitPerDay != null) {
      const taken = busy.filter((b) => localDate(b.start, hostTz) === dateKey).length;
      if (taken >= slot.limitPerDay) continue;
    }

    if (slot.limitPerWeek != null) {
      const wk = mondayKey(dateKey);
      const taken = busy.filter((b) => mondayKey(localDate(b.start, hostTz)) === wk).length;
      if (taken >= slot.limitPerWeek) continue;
    }

    const override = overrides.find((o) => o.date === dateKey);
    const ranges = override ? override.ranges : rules.filter((x) => x.weekday === weekday);
    for (const r of ranges) {
      const from = toMinutes(r.start), to = toMinutes(r.end);
      for (let t = from; t + slot.durationMinutes <= to; t += slot.stepMinutes) {
        const start = zonedToUtc(y, m, d, Math.floor(t / 60), t % 60, hostTz);
        if (start == null) continue;
        const end = start + dur;
        if (start < earliest || start > latest) continue;
        if (busy.some((b) => start - before < b.end && end + after > b.start)) continue;
        out.push(new Date(start).toISOString());
      }
    }
  }
  return [...new Set(out)].sort();
}
