"use client";
import { useMemo, useState } from "react";
import { saveAvailabilityAction } from "@/app/actions";
import type { Override, Rule } from "@/lib/availability";
import { Button, Field, Notice, Select } from "./ui";
import { useKeptForm } from "./useKeptForm";

type Range = { start: string; end: string };

const DAYS = [
  { n: 1, label: "Lundi" }, { n: 2, label: "Mardi" }, { n: 3, label: "Mercredi" }, { n: 4, label: "Jeudi" },
  { n: 5, label: "Vendredi" }, { n: 6, label: "Samedi" }, { n: 0, label: "Dimanche" },
];
const DEFAULT_RANGE: Range = { start: "09:00", end: "17:00" };
const TIME = "h-10 rounded-md border border-border-input bg-bg px-2 text-sm";

function RangesEditor({ label, ranges, onChange }: { label: string; ranges: Range[]; onChange: (r: Range[]) => void }) {
  const set = (i: number, patch: Partial<Range>) => onChange(ranges.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {ranges.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input type="time" aria-label={`${label}, plage ${i + 1}, début`} value={r.start} onChange={(e) => set(i, { start: e.target.value })} className={TIME} />
          <span aria-hidden>→</span>
          <input type="time" aria-label={`${label}, plage ${i + 1}, fin`} value={r.end} onChange={(e) => set(i, { end: e.target.value })} className={TIME} />
          <Button type="button" variant="ghost" size="sm" aria-label={`${label}, supprimer la plage ${i + 1}`} onClick={() => onChange(ranges.filter((_, j) => j !== i))}>Retirer</Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...ranges, { start: "14:00", end: "17:00" }])}>Ajouter une plage</Button>
    </div>
  );
}

export function AvailabilityForm({ rules, overrides: initialOverrides, timezone }: { rules: Rule[]; overrides: Override[]; timezone: string }) {
  const [state, action, pending] = useKeptForm(saveAvailabilityAction);
  const e = state.fieldErrors ?? {};
  const [week, setWeek] = useState<Record<number, Range[]>>(() => {
    const m: Record<number, Range[]> = {};
    for (const d of DAYS) m[d.n] = rules.filter((r) => r.weekday === d.n).map(({ start, end }) => ({ start, end }));
    return m;
  });
  const [overrides, setOverrides] = useState<Override[]>(initialOverrides);
  const [tz, setTz] = useState(timezone);

  const zones = useMemo(() => {
    let all: string[] = [];
    try { all = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone"); } catch { /* liste réduite */ }
    return all.includes(tz) ? all : [tz, ...all];
  }, [tz]);

  const weekly = DAYS.flatMap(({ n }) => week[n].map((r) => ({ weekday: n, ...r })));
  const setOv = (i: number, patch: Partial<Override>) => setOverrides(overrides.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <form onSubmit={action} className="max-w-2xl space-y-8" noValidate>
      <input type="hidden" name="weekly" value={JSON.stringify(weekly)} />
      <input type="hidden" name="overrides" value={JSON.stringify(overrides)} />
      {e.form && <Notice>{e.form}</Notice>}

      <Field id="timezone" label="Votre fuseau horaire" hint="Les heures ci-dessous sont dans ce fuseau." error={e.timezone}>
        <Select id="timezone" name="timezone" value={tz} onChange={(ev) => setTz(ev.target.value)} error={e.timezone}>
          {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
        </Select>
      </Field>

      <section className="space-y-3">
        <h2>Horaires de la semaine</h2>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {DAYS.map(({ n, label }) => {
            const ranges = week[n];
            const on = ranges.length > 0;
            return (
              <li key={n} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 font-semibold">
                    <input type="checkbox" checked={on} className="h-4 w-4 accent-[var(--color-accent)]"
                      onChange={(ev) => setWeek({ ...week, [n]: ev.target.checked ? [{ ...DEFAULT_RANGE }] : [] })} />
                    {label}
                  </label>
                  {on && (
                    <Button type="button" variant="ghost" size="sm" aria-label={`Copier les horaires du ${label.toLowerCase()} sur les autres jours ouvrés`}
                      onClick={() => setWeek({ ...week, ...Object.fromEntries([1, 2, 3, 4, 5].filter((d) => d !== n).map((d) => [d, ranges.map((r) => ({ ...r }))])) })}>
                      Copier sur lun.–ven.
                    </Button>
                  )}
                </div>
                {on ? <RangesEditor label={label} ranges={ranges} onChange={(r) => setWeek({ ...week, [n]: r })} /> : <p className="text-sm text-muted">Indisponible</p>}
                {e[`day-${n}`] && <p className="text-sm text-danger">{e[`day-${n}`]}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2>Exceptions pour certaines dates</h2>
        <p className="text-sm text-muted">Une exception remplace les horaires habituels de ce jour : congé, jour férié ou horaires particuliers.</p>
        {e.overrides && <p className="text-sm text-danger">{e.overrides}</p>}
        {overrides.length === 0 && <p className="text-sm text-muted">Aucune exception.</p>}
        <ul className="space-y-3">
          {overrides.map((o, i) => {
            const label = `Exception ${i + 1}`;
            return (
              <li key={i} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor={`ov-date-${i}`} className="mb-1 block text-sm font-semibold">Date</label>
                    <input id={`ov-date-${i}`} type="date" value={o.date} onChange={(ev) => setOv(i, { date: ev.target.value })} className={TIME} />
                  </div>
                  <div>
                    <label htmlFor={`ov-mode-${i}`} className="mb-1 block text-sm font-semibold">Ce jour-là</label>
                    <select id={`ov-mode-${i}`} value={o.ranges.length ? "custom" : "off"} className={TIME}
                      onChange={(ev) => setOv(i, { ranges: ev.target.value === "off" ? [] : [{ ...DEFAULT_RANGE }] })}>
                      <option value="off">Indisponible toute la journée</option>
                      <option value="custom">Horaires particuliers</option>
                    </select>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOverrides(overrides.filter((_, j) => j !== i))}>Supprimer {label.toLowerCase()}</Button>
                </div>
                {o.ranges.length > 0 && <RangesEditor label={label} ranges={o.ranges} onChange={(r) => setOv(i, { ranges: r })} />}
                {e[`override-${o.date}`] && <p className="text-sm text-danger">{e[`override-${o.date}`]}</p>}
              </li>
            );
          })}
        </ul>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOverrides([...overrides, { date: "", ranges: [] }])}>Ajouter une exception</Button>
      </section>

      {state.saved && <Notice tone="success">Disponibilités enregistrées.</Notice>}
      <Button type="submit" loading={pending}>Enregistrer</Button>
    </form>
  );
}
