import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";
import { cancelBookingAction } from "@/app/actions";
import { formatDateTime } from "@/lib/format";
import { getCurrentHost, getEventTypeById, listBookings } from "@/lib/store";
import type { Booking } from "@/lib/types";

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
  const host = getCurrentHost();
  const now = Date.now();
  const all = listBookings(host.id);
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
        <div className="relative overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Réunions : {view.label.toLowerCase()}</caption>
            <thead className="bg-surface">
              <tr>
                <th scope="col" className="px-4 py-3">Quand</th>
                <th scope="col" className="px-4 py-3">Invité</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((b) => {
                const et = getEventTypeById(b.eventTypeId);
                const answered = et?.questions.filter((q) => b.answers[q.id]) ?? [];
                return (
                  <tr key={b.id} className={b.status === "cancelled" ? "text-muted" : ""}>
                    <td className="px-4 py-3 align-top">{formatDateTime(b.startAt, host.timezone)}</td>
                    <td className="px-4 py-3 align-top">
                      <span className="break-words font-semibold">{b.guestName}</span><br />
                      <span className="text-muted">{b.guestEmail}</span>
                      {answered.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-sm text-accent">Réponses ({answered.length})</summary>
                          <dl className="mt-1 space-y-1">
                            {answered.map((q) => (
                              <div key={q.id}>
                                <dt className="text-muted">{q.label}</dt>
                                <dd className="whitespace-pre-line break-words">{q.kind === "checkbox" ? "Oui" : b.answers[q.id]}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      )}
                      {b.status === "cancelled" && b.cancelReason && <p className="mt-1">Motif : {b.cancelReason}</p>}
                    </td>
                    <td className="px-4 py-3 align-top">{et?.name}</td>
                    <td className="px-4 py-3 text-right align-top">
                      {b.status === "confirmed" && view.key === "a-venir" && (
                        <form action={cancelBookingAction}>
                          <input type="hidden" name="token" value={b.manageToken} />
                          <input type="hidden" name="by" value="host" />
                          <Button type="submit" variant="ghost" size="sm" aria-label={`Annuler la réunion avec ${b.guestName}`}>Annuler</Button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
