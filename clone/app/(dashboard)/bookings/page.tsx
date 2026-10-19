import type { Metadata } from "next";
import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";
import { cancelBookingAsHostAction } from "@/app/actions";
import { formatDateTime } from "@/lib/format";
import { requireHost } from "@/lib/auth";
import { listBookings, listEventTypes } from "@/lib/store";
import type { Booking } from "@/lib/types";

// Colonnes en affichage tableau : date, invité, type, action. En carte, tout s'empile.
const ROW_COLS = "grid gap-2 md:grid-cols-[13rem_minmax(0,1fr)_minmax(0,1fr)_6rem] md:gap-4";

const VIEWS = [
  { key: "a-venir", label: "À venir", empty: "Aucune réunion à venir", hint: "Dès que quelqu'un réserve un créneau, la réunion apparaît ici." },
  { key: "passees", label: "Passées", empty: "Aucune réunion passée", hint: "Les réunions terminées s'afficheront ici." },
  { key: "annulees", label: "Annulées", empty: "Aucune réunion annulée", hint: "Les réservations annulées s'afficheront ici." },
] as const;

function bucket(b: Booking, now: number): (typeof VIEWS)[number]["key"] {
  if (b.status === "cancelled") return "annulees";
  return Date.parse(b.endAt) < now ? "passees" : "a-venir";
}

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue } = await searchParams;
  const { host } = await requireHost();
  const now = Date.now();
  const all = await listBookings(host.id);
  const types = new Map((await listEventTypes(host.id)).map((t) => [t.id, t]));
  const view = VIEWS.find((v) => v.key === vue) ?? VIEWS[0];
  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, all.filter((b) => bucket(b, now) === v.key).length]));
  const rows = all.filter((b) => bucket(b, now) === view.key);
  if (view.key !== "a-venir") rows.reverse();

  return (
    <div className="space-y-6">
      <h1>Réunions</h1>
      <nav aria-label="Filtrer les réunions" className="flex gap-1 border-b border-border">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`/bookings?vue=${v.key}`} aria-current={v.key === view.key ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${v.key === view.key ? "border-accent text-text" : "border-transparent text-muted hover:text-text"}`}>
            {v.label} ({counts[v.key]})
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title={view.empty}>{view.hint}</EmptyState>
      ) : (
        // Cartes empilées sous 768 px, tableau au-delà. Un seul DOM : les rôles ARIA gardent la sémantique de tableau
        // (lignes, cellules, en-têtes) quel que soit l'affichage. Les libellés « Invité » et « Type » ne servent qu'en carte.
        <div role="table" aria-label={`Réunions : ${view.label.toLowerCase()}`} className="md:overflow-hidden md:rounded-lg md:border md:border-border">
          <div role="rowgroup" className="hidden md:block">
            <div role="row" className={`${ROW_COLS} bg-surface px-4 py-3 text-sm font-semibold`}>
              <div role="columnheader">Quand</div>
              <div role="columnheader">Invité</div>
              <div role="columnheader">Type</div>
              <div role="columnheader"><span className="sr-only">Actions</span></div>
            </div>
          </div>
          <div role="rowgroup" className="space-y-3 md:space-y-0 md:divide-y md:divide-border">
            {rows.map((b) => {
              const et = types.get(b.eventTypeId);
              const answered = et?.questions.filter((q) => b.answers[q.id]) ?? [];
              return (
                <div key={b.id} role="row"
                  className={`${ROW_COLS} rounded-lg border border-border p-4 text-sm md:items-start md:rounded-none md:border-0 ${b.status === "cancelled" ? "text-muted" : ""}`}>
                  <div role="cell" className="font-semibold md:font-normal">{formatDateTime(b.startAt, host.timezone)}</div>
                  <div role="cell" className="wrap-anywhere">
                    <span className="font-semibold">{b.guestName}</span><br />
                    <span className="text-muted">{b.guestEmail}</span>
                    {answered.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-sm text-accent">Réponses ({answered.length})</summary>
                        <dl className="mt-1 space-y-1">
                          {answered.map((q) => (
                            <div key={q.id}>
                              <dt className="text-muted">{q.label}</dt>
                              <dd className="whitespace-pre-line">{q.kind === "checkbox" ? "Oui" : b.answers[q.id]}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    )}
                    {b.status === "cancelled" && b.cancelReason && <p className="mt-1">Motif : {b.cancelReason}</p>}
                  </div>
                  <div role="cell" className="wrap-anywhere"><span className="text-muted md:hidden">Type : </span>{et?.name}</div>
                  <div role="cell" className="md:text-right">
                    {b.status === "confirmed" && view.key === "a-venir" && (
                      <form action={cancelBookingAsHostAction}>
                        <input type="hidden" name="token" value={b.manageToken} />
                        <Button type="submit" variant="secondary" size="sm" className="w-full whitespace-nowrap md:w-auto md:border-0 md:bg-transparent" aria-label={`Annuler la réunion avec ${b.guestName}`}>Annuler</Button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export const metadata: Metadata = { title: "Réunions" };
