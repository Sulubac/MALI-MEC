import type { Metadata } from "next";
import { EventTypeForm } from "@/components/EventTypeForm";

export default function NewEventTypePage() {
  return (
    <div className="space-y-6">
      <h1>Nouveau type d'événement</h1>
      <EventTypeForm />
    </div>
  );
}

export const metadata: Metadata = { title: "Nouveau type d'événement" };
