// Validation des formulaires (pure : testable sans serveur).
import type { Override, Rule } from "./availability.ts";
import type { EventTypeInput, Question } from "./types.ts";

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const LOCATIONS = ["video", "phone", "in_person", "custom"] as const;
const KINDS = ["text", "textarea", "select", "checkbox"] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function optInt(raw: string, min: number, max: number): number | null | "invalid" {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= min && n <= max ? n : "invalid";
}

export function parseQuestions(raw: string, makeId: () => string): Parsed<Question[]> {
  let arr: unknown;
  try { arr = JSON.parse(raw || "[]"); } catch { return { ok: false, errors: { questions: "Questions illisibles." } }; }
  if (!Array.isArray(arr) || arr.length > 10) return { ok: false, errors: { questions: "10 questions au maximum." } };
  const out: Question[] = [];
  for (let i = 0; i < arr.length; i++) {
    const q = arr[i] as Partial<Question>;
    const label = String(q.label ?? "").trim();
    if (!label || label.length > 200) return { ok: false, errors: { questions: `Question ${i + 1} : indiquez un intitulé (200 caractères au plus).` } };
    const kind = (KINDS as readonly string[]).includes(String(q.kind)) ? (q.kind as Question["kind"]) : null;
    if (!kind) return { ok: false, errors: { questions: `Question ${i + 1} : type inconnu.` } };
    const options = kind === "select" ? (Array.isArray(q.options) ? q.options.map((o) => String(o).trim()).filter(Boolean) : []) : [];
    if (kind === "select" && (options.length < 2 || options.length > 20)) return { ok: false, errors: { questions: `Question ${i + 1} : proposez entre 2 et 20 choix.` } };
    out.push({ id: typeof q.id === "string" && q.id ? q.id : makeId(), label, kind, options, required: q.required === true });
  }
  return { ok: true, value: out };
}

export function parseEventTypeForm(get: (k: string) => string, makeId: () => string): Parsed<EventTypeInput> {
  const errors: Record<string, string> = {};
  const name = get("name").trim();
  if (!name) errors.name = "Donnez un nom à ce type d'événement.";
  else if (name.length > 80) errors.name = "80 caractères au maximum.";

  const duration = Number(get("duration"));
  if (!Number.isInteger(duration) || duration < 5 || duration > 720) errors.duration = "Choisissez une durée entre 5 et 720 minutes.";

  const locationKind = get("locationKind") as (typeof LOCATIONS)[number];
  if (!LOCATIONS.includes(locationKind)) errors.locationKind = "Lieu non reconnu.";

  const minNotice = optInt(get("minNotice"), 0, 60 * 24 * 60);
  if (minNotice === null || minNotice === "invalid") errors.minNotice = "Choisissez un préavis valide.";
  const maxDays = optInt(get("maxDays"), 1, 365);
  if (maxDays === null || maxDays === "invalid") errors.maxDays = "Entre 1 et 365 jours.";
  const bufBefore = optInt(get("bufferBefore"), 0, 240);
  if (bufBefore === null || bufBefore === "invalid") errors.bufferBefore = "Entre 0 et 240 minutes.";
  const bufAfter = optInt(get("bufferAfter"), 0, 240);
  if (bufAfter === null || bufAfter === "invalid") errors.bufferAfter = "Entre 0 et 240 minutes.";
  const perDay = optInt(get("limitPerDay"), 1, 50);
  if (perDay === "invalid") errors.limitPerDay = "Un nombre entier entre 1 et 50, ou vide.";
  const perWeek = optInt(get("limitPerWeek"), 1, 250);
  if (perWeek === "invalid") errors.limitPerWeek = "Un nombre entier entre 1 et 250, ou vide.";
  if (typeof perDay === "number" && typeof perWeek === "number" && perWeek < perDay) errors.limitPerWeek = "La limite par semaine ne peut pas être inférieure à celle par jour.";

  const redirect = get("redirectUrl").trim();
  if (redirect) {
    let ok = false;
    try { ok = new URL(redirect).protocol === "https:"; } catch { /* invalide */ }
    if (!ok) errors.redirectUrl = "Saisissez une adresse complète en https://";
  }

  const qs = parseQuestions(get("questions"), makeId);
  if (!qs.ok) Object.assign(errors, qs.errors);

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name, durationMinutes: duration, locationKind, locationDetail: get("locationDetail").trim().slice(0, 200),
      description: get("description").trim().slice(0, 1000),
      minNoticeMinutes: minNotice as number, maxDaysAhead: maxDays as number,
      bufferBeforeMinutes: bufBefore as number, bufferAfterMinutes: bufAfter as number,
      limitPerDay: perDay as number | null, limitPerWeek: perWeek as number | null,
      questions: (qs as { ok: true; value: Question[] }).value, confirmationRedirectUrl: redirect,
    },
  };
}

function rangesOverlap(ranges: { start: string; end: string }[]): boolean {
  const s = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  return s.some((r, i) => i > 0 && r.start < s[i - 1].end);
}

export function parseAvailability(weeklyRaw: string, overridesRaw: string, tz: string): Parsed<{ rules: Rule[]; overrides: Override[]; timezone: string }> {
  const errors: Record<string, string> = {};
  try { new Intl.DateTimeFormat("fr-FR", { timeZone: tz }); } catch { errors.timezone = "Fuseau horaire inconnu."; }

  let weekly: unknown, overrides: unknown;
  try { weekly = JSON.parse(weeklyRaw || "[]"); overrides = JSON.parse(overridesRaw || "[]"); } catch { return { ok: false, errors: { form: "Données illisibles." } }; }
  if (!Array.isArray(weekly) || !Array.isArray(overrides)) return { ok: false, errors: { form: "Données illisibles." } };

  const rules: Rule[] = [];
  const byDay = new Map<number, { start: string; end: string }[]>();
  for (const r of weekly as Rule[]) {
    const wd = Number(r.weekday);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6 || !HHMM.test(r.start) || !HHMM.test(r.end) || r.end <= r.start) {
      errors[`day-${Number.isInteger(wd) ? wd : 0}`] = "L'heure de fin doit suivre l'heure de début.";
      continue;
    }
    rules.push({ weekday: wd, start: r.start, end: r.end });
    byDay.set(wd, [...(byDay.get(wd) ?? []), { start: r.start, end: r.end }]);
  }
  for (const [wd, rs] of byDay) if (rangesOverlap(rs)) errors[`day-${wd}`] = "Ces plages se chevauchent.";

  const out: Override[] = [];
  if ((overrides as Override[]).length > 200) errors.overrides = "200 exceptions au maximum.";
  const seen = new Set<string>();
  for (const o of overrides as Override[]) {
    if (!DATE.test(o.date) || Number.isNaN(Date.parse(o.date + "T00:00:00Z"))) { errors.overrides = "Une date d'exception est invalide."; continue; }
    if (seen.has(o.date)) { errors.overrides = `La date ${o.date} apparaît deux fois.`; continue; }
    seen.add(o.date);
    const ranges = Array.isArray(o.ranges) ? o.ranges : [];
    if (ranges.some((r) => !HHMM.test(r.start) || !HHMM.test(r.end) || r.end <= r.start) || rangesOverlap(ranges)) {
      errors[`override-${o.date}`] = "Plages invalides ou qui se chevauchent.";
      continue;
    }
    out.push({ date: o.date, ranges: ranges.map((r) => ({ start: r.start, end: r.end })) });
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { rules, overrides: out.sort((a, b) => a.date.localeCompare(b.date)), timezone: tz } };
}
