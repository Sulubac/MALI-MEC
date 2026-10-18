import { notFound } from "next/navigation";
import { EventTypeForm } from "@/components/EventTypeForm";
import { getCurrentHost, getEventTypeById } from "@/lib/store";

export default async function EditEventTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const et = getEventTypeById(id);
  if (!et || et.ownerId !== getCurrentHost().id) notFound();
  return (
    <div className="space-y-6">
      <h1 className="break-words">Modifier « {et.name} »</h1>
      <p className="text-sm text-muted">Le lien de réservation ne change pas : les liens déjà partagés restent valables.</p>
      <EventTypeForm initial={et} />
    </div>
  );
}
