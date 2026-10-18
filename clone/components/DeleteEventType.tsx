"use client";
import { useState } from "react";
import { deleteEventTypeAction } from "@/app/actions";
import { Button } from "./ui";
import { useKeptForm } from "./useKeptForm";

export function DeleteEventType({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useKeptForm(deleteEventTypeAction);
  if (!confirming) {
    return <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label={`Supprimer ${name}`}>Supprimer</Button>;
  }
  return (
    <form onSubmit={action} className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirmer la suppression de ${name}`}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="danger" size="sm" loading={pending}>Confirmer</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>Garder</Button>
      {state.error && <p role="alert" className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
