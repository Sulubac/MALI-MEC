"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookAction } from "@/app/actions";
import { Button, EmptyState, Field, Notice, Select, TextInput } from "./ui";

type Props = {
  username: string;
  slug: string;
  hostName: string;
  hostTimezone: string;
  eventName: string;
  durationMinutes: number;
  description: string;
  locationLabel: string;
  slots: string[];
  reschedule?: { token: string; guestName: string; guestEmail: string };
};

const WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

function dayKey(iso: string | number, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function timeLabel(iso: string, tz: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function longDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function BookingFlow(p: Props) {
  const router = useRouter();
  const [tz, setTz] = useState(p.hostTimezone);
  const [slots, setSlots] = useState(p.slots);
  const [month, setMonth] = useState<string | null>(null); // "YYYY-MM"
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState(p.reschedule?.guestName ?? "");
  const [email, setEmail] = useState(p.reschedule?.guestEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => { setSlots(p.slots); }, [p.slots]);
  useEffect(() => {
    try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || p.hostTimezone); } catch { /* garde le fuseau de l'hôte */ }
  }, [p.hostTimezone]);

  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of slots) {
      const k = dayKey(s, tz);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return m;
  }, [slots, tz]);

  const firstDay = [...byDay.keys()].sort()[0];
  const shownMonth = month ?? (firstDay ? firstDay.slice(0, 7) : dayKey(Date.now(), tz).slice(0, 7));
  const [yy, mm] = shownMonth.split("-").map(Number);
  const lead = (new Date(Date.UTC(yy, mm - 1, 1)).getUTCDay() + 6) % 7; // lundi en premier
  const daysInMonth = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(yy, mm - 1, 1)));
  const monthKeys = [...byDay.keys()].map((k) => k.slice(0, 7));
  const hasPrev = monthKeys.some((k) => k < shownMonth);
  const hasNext = monthKeys.some((k) => k > shownMonth);
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(yy, mm - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    setDay(null); setSlot(null);
  };

  const zones = useMemo(() => {
    let all: string[] = [];
    try { all = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone"); } catch { /* liste réduite */ }
    return all.includes(tz) ? all : [tz, ...all];
  }, [tz]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    setError(null);
    startTransition(async () => {
      const res = await bookAction({
        username: p.username, slug: p.slug, startAt: slot, guestName: name, guestEmail: email,
        guestTimezone: tz, rescheduleToken: p.reschedule?.token,
      });
      if (res.ok) { router.push(`/booking/${res.token}`); return; }
      setError(res.message);
      if (res.code !== "invalid") { setSlot(null); router.refresh(); }
    });
  }

  const times = day ? byDay.get(day) ?? [] : [];

  return (
    <div className="grid gap-6 md:grid-cols-[18rem_1fr]">
      <div className="space-y-2">
        <p className="text-sm text-muted">{p.hostName}</p>
        <h1 className="break-words">{p.eventName}</h1>
        <p className="text-sm text-muted">{p.durationMinutes} min · {p.locationLabel}</p>
        {p.description && <p className="whitespace-pre-line break-words text-sm">{p.description}</p>}
        {p.reschedule && <Notice tone="success">Vous choisissez un nouveau créneau pour remplacer votre réservation.</Notice>}
      </div>

      <div className="space-y-6">
        {byDay.size === 0 ? (
          <EmptyState title="Aucun créneau libre pour le moment">Revenez plus tard, de nouveaux créneaux peuvent s'ouvrir.</EmptyState>
        ) : (
          <>
            <Field id="tz" label="Votre fuseau horaire">
              <Select id="tz" value={tz} onChange={(e) => { setTz(e.target.value); setDay(null); setSlot(null); }}>
                {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
              </Select>
            </Field>

            <section aria-label="Choisir une date">
              <div className="mb-2 flex items-center justify-between">
                <Button type="button" variant="ghost" size="sm" disabled={!hasPrev} onClick={() => shift(-1)} aria-label="Mois précédent">←</Button>
                <h2 className="capitalize" aria-live="polite">{monthLabel}</h2>
                <Button type="button" variant="ghost" size="sm" disabled={!hasNext} onClick={() => shift(1)} aria-label="Mois suivant">→</Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted" aria-hidden>
                {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const n = i + 1;
                  const key = `${shownMonth}-${String(n).padStart(2, "0")}`;
                  const count = byDay.get(key)?.length ?? 0;
                  const selected = day === key;
                  return (
                    <button key={key} type="button" disabled={count === 0} aria-pressed={selected}
                      aria-label={`${longDay(key)}${count ? `, ${count} créneaux` : ", aucun créneau"}`}
                      onClick={() => { setDay(key); setSlot(null); setError(null); }}
                      className={`aspect-square rounded-md text-sm font-semibold transition-colors duration-fast ${selected ? "bg-accent text-on-accent" : count ? "bg-accent-subtle text-text hover:bg-border" : "text-muted opacity-60"}`}>
                      {n}
                    </button>
                  );
                })}
              </div>
            </section>

            {day && (
              <section aria-label={`Créneaux du ${longDay(day)}`} className="space-y-2">
                <h2 className="text-base capitalize">{longDay(day)}</h2>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {times.map((t) => (
                    <li key={t}>
                      <button type="button" aria-pressed={slot === t} onClick={() => { setSlot(t); setError(null); }}
                        className={`h-10 w-full rounded-md border text-sm font-semibold ${slot === t ? "border-accent bg-accent text-on-accent" : "border-accent text-accent hover:bg-accent-subtle"}`}>
                        {timeLabel(t, tz)}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {error && <Notice>{error}</Notice>}

            {slot && (
              <form onSubmit={submit} className="space-y-4 rounded-lg border border-border p-4" noValidate>
                <h2 className="text-base">Vos coordonnées</h2>
                <Field id="guest-name" label="Nom">
                  <TextInput id="guest-name" required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field id="guest-email" label="Adresse e-mail">
                  <TextInput id="guest-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Button type="submit" loading={pending}>Confirmer le {longDay(dayKey(slot, tz))} à {timeLabel(slot, tz)}</Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
