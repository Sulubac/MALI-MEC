"use client";
import { useActionState } from "react";
import { saveAvailabilityAction, type FormState } from "@/app/actions";
import type { Rule } from "@/lib/availability";
import { Button, Notice } from "./ui";

const DAYS = [
  { n: 1, label: "Lundi" }, { n: 2, label: "Mardi" }, { n: 3, label: "Mercredi" }, { n: 4, label: "Jeudi" },
  { n: 5, label: "Vendredi" }, { n: 6, label: "Samedi" }, { n: 0, label: "Dimanche" },
];

export function AvailabilityForm({ rules, timezone }: { rules: Rule[]; timezone: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAvailabilityAction, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-xl space-y-4">
      <p className="text-sm text-muted">Heures dans votre fuseau : {timezone}</p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {DAYS.map(({ n, label }) => {
          const r = rules.find((x) => x.weekday === n);
          return (
            <li key={n} className="flex flex-wrap items-center gap-3 p-3">
              <label className="flex w-36 items-center gap-2 font-semibold">
                <input type="checkbox" name={`on-${n}`} defaultChecked={!!r} className="h-4 w-4 accent-[var(--color-accent)]" />
                {label}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="sr-only">{label}, début</span>
                <input type="time" name={`start-${n}`} defaultValue={r?.start ?? "09:00"} className="h-10 rounded-md border border-border-input px-2" />
              </label>
              <span aria-hidden>→</span>
              <label className="flex items-center gap-2 text-sm">
                <span className="sr-only">{label}, fin</span>
                <input type="time" name={`end-${n}`} defaultValue={r?.end ?? "17:00"} className="h-10 rounded-md border border-border-input px-2" />
              </label>
              {e[`day-${n}`] && <p className="w-full text-sm text-danger">{e[`day-${n}`]}</p>}
            </li>
          );
        })}
      </ul>
      {state.saved && <Notice tone="success">Disponibilités enregistrées.</Notice>}
      <Button type="submit" loading={pending}>Enregistrer</Button>
    </form>
  );
}
