import type { Metadata } from "next";
import { CalendarSettings, DisconnectGoogle } from "@/components/CalendarSettings";
import { Button, Card, Notice } from "@/components/ui";
import { connectGoogleAction } from "@/app/actions";
import { requireHost } from "@/lib/auth";
import { getCalendarView } from "@/lib/calendar";
import { googleConfig } from "@/lib/google";

export const metadata: Metadata = { title: "Calendrier" };

const MESSAGES: Record<string, { tone: "success" | "danger"; text: string }> = {
  connected: { tone: "success", text: "Google Agenda est connecté." },
  readonly: { tone: "success", text: "Google Agenda est connecté en lecture seule : vous n'avez pas autorisé l'ajout d'événements." },
  disconnected: { tone: "success", text: "Google Agenda est déconnecté." },
  denied: { tone: "danger", text: "Vous avez refusé l'accès : rien n'a été connecté." },
  scope: { tone: "danger", text: "L'accès à vos disponibilités n'a pas été accordé : sans lui, Planifier ne peut pas éviter vos créneaux occupés. Recommencez en acceptant cette autorisation." },
  state: { tone: "danger", text: "La demande de connexion a expiré ou n'est pas valide. Recommencez." },
  no_refresh: { tone: "danger", text: "Google n'a pas fourni d'autorisation durable. Retirez l'accès de Planifier dans votre compte Google, puis recommencez." },
  google: { tone: "danger", text: "Google n'a pas pu finaliser la connexion. Réessayez dans quelques minutes." },
  rate: { tone: "danger", text: "Trop de tentatives. Réessayez dans quelques minutes." },
  not_configured: { tone: "danger", text: "La connexion à Google Agenda n'est pas activée sur ce serveur." },
};

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ connected?: string; disconnected?: string; error?: string }> }) {
  const { host } = await requireHost();
  const sp = await searchParams;
  const key = sp.error ?? (sp.connected === "readonly" ? "readonly" : sp.connected ? "connected" : sp.disconnected ? "disconnected" : "");
  const msg = Object.hasOwn(MESSAGES, key) ? MESSAGES[key] : undefined; // « __proto__ », « constructor »… ne sont pas des messages
  const configured = googleConfig() !== null;
  const view = await getCalendarView(host.id);

  return (
    <div className="space-y-6">
      <h1>Calendrier</h1>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {!configured ? (
        <Card className="max-w-xl space-y-2 p-4">
          <h2 className="text-base">Google Agenda</h2>
          <p className="text-sm text-muted">La connexion à Google Agenda n'est pas activée sur ce serveur. L'administrateur doit renseigner les identifiants Google et la clé de chiffrement.</p>
        </Card>
      ) : !view ? (
        <Card className="max-w-xl space-y-4 p-4">
          <h2 className="text-base">Google Agenda</h2>
          <p className="text-sm">Reliez votre agenda pour que vos événements bloquent les créneaux proposés, et pour y retrouver vos rendez-vous.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Lecture : uniquement les moments où vous êtes occupé, pas le contenu des événements.</li>
            <li>Écriture : un événement par réservation, supprimé si elle est annulée.</li>
            <li>Agenda principal seulement. Vous pouvez déconnecter à tout moment.</li>
          </ul>
          <form action={connectGoogleAction}><Button type="submit">Connecter Google Agenda</Button></form>
        </Card>
      ) : view.status === "revoked" ? (
        <Card className="wrap-anywhere max-w-xl space-y-4 p-4">
          <h2 className="text-base">Google Agenda : reconnexion nécessaire</h2>
          <Notice>Google a mis fin à l'accès ({view.email}). Vos rendez-vous ne tiennent plus compte de votre agenda tant que vous ne l'avez pas reconnecté.</Notice>
          <div className="flex flex-wrap gap-3">
            <form action={connectGoogleAction}><Button type="submit">Reconnecter Google Agenda</Button></form>
            <DisconnectGoogle />
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="wrap-anywhere max-w-xl space-y-1 p-4">
            <h2 className="text-base">Google Agenda connecté</h2>
            <p className="text-sm">Compte : <span className="font-semibold">{view.email}</span></p>
            {view.lastError && <p role="status" className="text-sm text-danger">Dernier problème : {view.lastError}</p>}
          </Card>
          <CalendarSettings checkBusy={view.checkBusy} writeBookings={view.writeBookings} canWrite={view.canWrite} />
          <DisconnectGoogle />
        </div>
      )}
    </div>
  );
}
