import { Button, EmptyState } from "@/components/ui";
import { cancelBookingAction } from "@/app/actions";
import { formatDateTime } from "@/lib/format";
import { getCurrentHost, getEventTypeById, listBookings } from "@/lib/store";

export default function BookingsPage() {
  const host = getCurrentHost();
  const rows = listBookings(host.id);
  return (
    <div className="space-y-6">
      <h1>Réunions</h1>
      {rows.length === 0 ? (
        <EmptyState title="Aucune réunion planifiée">Dès que quelqu'un réserve un créneau, la réunion apparaît ici.</EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Réunions planifiées</caption>
            <thead className="bg-surface">
              <tr>
                <th scope="col" className="px-4 py-3">Quand</th>
                <th scope="col" className="px-4 py-3">Invité</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3">Statut</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((b) => (
                <tr key={b.id} className={b.status === "cancelled" ? "text-muted" : ""}>
                  <td className="px-4 py-3">{formatDateTime(b.startAt, host.timezone)}</td>
                  <td className="px-4 py-3"><span className="break-words">{b.guestName}</span><br /><span className="text-muted">{b.guestEmail}</span></td>
                  <td className="px-4 py-3">{getEventTypeById(b.eventTypeId)?.name}</td>
                  <td className="px-4 py-3">{b.status === "confirmed" ? "Confirmée" : "Annulée"}</td>
                  <td className="px-4 py-3 text-right">
                    {b.status === "confirmed" && (
                      <form action={cancelBookingAction}>
                        <input type="hidden" name="token" value={b.manageToken} />
                        <input type="hidden" name="by" value="host" />
                        <Button type="submit" variant="ghost" size="sm">Annuler</Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
