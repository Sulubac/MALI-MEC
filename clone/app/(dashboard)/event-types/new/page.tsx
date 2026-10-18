import { EventTypeForm } from "@/components/EventTypeForm";
import { ButtonLink } from "@/components/ui";

export default function NewEventTypePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1>Nouveau type d'événement</h1>
        <ButtonLink href="/event-types" variant="ghost">Annuler</ButtonLink>
      </div>
      <EventTypeForm />
    </div>
  );
}
