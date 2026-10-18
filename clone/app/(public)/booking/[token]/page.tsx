import { notFound } from "next/navigation";
import { Button, ButtonLink, Card, Field, Notice, TextArea } from "@/components/ui";
import { cancelBookingAction } from "@/app/actions";
import { formatDateTime, LOCATION_LABEL } from "@/lib/format";
import { getBookingByToken, getEventTypeById, getHostByUsername } from "@/lib/store";
import { getCurrentHost } from "@/lib/store";

export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = getBookingByToken(token);
  if (!b) notFound();
  const et = getEventTypeById(b.eventTypeId);
  const host = getHostByUsername(getCurrentHost().username)!;
  const cancelled = b.status === "cancelled";
  const past = Date.parse(b.startAt) < Date.now();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      {cancelled ? <Notice>Cette réservation est annulée.</Notice> : <Notice tone="success">C'est confirmé. Un e-mail de confirmation vous est destiné.</Notice>}
      <h1 className="break-words">{et?.name}</h1>
      <Card className="space-y-2 p-4 text-sm">
        <p><span className="text-muted">Avec</span> {host.displayName}</p>
        <p className={cancelled ? "line-through" : ""}><span className="text-muted">Quand</span> {formatDateTime(b.startAt, b.guestTimezone)}</p>
        <p className="text-muted">Fuseau : {b.guestTimezone.replace(/_/g, " ")}</p>
        {et && <p><span className="text-muted">Lieu</span> {LOCATION_LABEL[et.locationKind]}{et.locationDetail ? ` : ${et.locationDetail}` : ""}</p>}
        <p><span className="text-muted">Invité</span> {b.guestName} ({b.guestEmail})</p>
        {cancelled && b.cancelReason && <p><span className="text-muted">Motif</span> {b.cancelReason}</p>}
      </Card>
      {!cancelled && !past && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/booking/${token}/ics`} variant="secondary">Ajouter à mon agenda</ButtonLink>
            {et && <ButtonLink href={`/${host.username}/${et.slug}?reschedule=${token}`} variant="secondary">Choisir un autre créneau</ButtonLink>}
          </div>
          <form action={cancelBookingAction} className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-base">Annuler cette réservation</h2>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="by" value="guest" />
            <Field id="reason" label="Motif" hint="Facultatif, transmis à l'organisateur.">
              <TextArea id="reason" name="reason" maxLength={500} />
            </Field>
            <Button type="submit" variant="danger">Annuler la réservation</Button>
          </form>
        </div>
      )}
      {cancelled && et && <ButtonLink href={`/${host.username}/${et.slug}`}>Réserver un nouveau créneau</ButtonLink>}
    </div>
  );
}
