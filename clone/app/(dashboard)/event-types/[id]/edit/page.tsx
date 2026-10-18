import { notFound } from "next/navigation";
import { EventTypeForm } from "@/components/EventTypeForm";
import { requireHost } from "@/lib/auth";
import { getOwnedEventType } from "@/lib/store";

export const metadata = { title: "Modifier un type d'événement" };

export default async function EditEventTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { host } = await requireHost();
  const et = await getOwnedEventType(host.id, id);
  if (!et) notFound();
  return (
    <div className="space-y-6">
      <h1 className="wrap-anywhere">Modifier « {et.name} »</h1>
      <p className="text-sm text-muted">Le lien de réservation ne change pas : les liens déjà partagés restent valables.</p>
      <EventTypeForm initial={et} />
    </div>
  );
}
