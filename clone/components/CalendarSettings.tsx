"use client";
import { useState } from "react";
import { saveCalendarOptionsAction, disconnectGoogleAction } from "@/app/actions";
import { Button, Notice } from "./ui";
import { useKeptForm } from "./useKeptForm";

export function CalendarSettings({ checkBusy, writeBookings, canWrite }: { checkBusy: boolean; writeBookings: boolean; canWrite: boolean }) {
  const [state, action, pending] = useKeptForm(saveCalendarOptionsAction);
  return (
    <form onSubmit={action} className="max-w-xl space-y-4">
      {state.error && <Notice>{state.error}</Notice>}
      <label className="flex items-start gap-3">
        <input type="checkbox" name="checkBusy" defaultChecked={checkBusy} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
        <span><span className="font-semibold">Ne pas proposer les créneaux où je suis déjà occupé</span><br />
          <span className="text-sm text-muted">Seuls les moments occupés sont lus, jamais le titre ni le contenu de vos événements.</span></span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="writeBookings" defaultChecked={writeBookings} disabled={!canWrite} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
        <span><span className="font-semibold">Ajouter les rendez-vous réservés à mon agenda</span><br />
          <span className="text-sm text-muted">{canWrite ? "Un événement est créé à chaque réservation, et supprimé si elle est annulée." : "Vous n'avez pas autorisé l'ajout d'événements. Reconnectez l'agenda en acceptant cette autorisation pour l'activer."}</span></span>
      </label>
      {state.saved && <Notice tone="success">Réglages enregistrés.</Notice>}
      <Button type="submit" loading={pending}>Enregistrer</Button>
    </form>
  );
}

export function DisconnectGoogle() {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) return <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>Déconnecter Google Agenda</Button>;
  return (
    <form action={disconnectGoogleAction} role="group" aria-label="Confirmer la déconnexion de Google Agenda" className="max-w-xl space-y-3 rounded-lg border border-danger p-4">
      <p className="text-sm">Planifier cessera de lire votre agenda et d'y écrire. Les événements déjà ajoutés y restent. L'accès sera aussi retiré côté Google.</p>
      <div className="flex gap-2">
        <Button type="submit" variant="danger">Confirmer la déconnexion</Button>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>Garder la connexion</Button>
      </div>
    </form>
  );
}
