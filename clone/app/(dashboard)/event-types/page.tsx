import { ButtonLink, Button, Card, EmptyState } from "@/components/ui";
import { CopyLink } from "@/components/CopyLink";
import { toggleEventTypeAction } from "@/app/actions";
import { requireHost } from "@/lib/auth";
import { listEventTypes } from "@/lib/store";
import { DeleteEventType } from "@/components/DeleteEventType";
import { LOCATION_LABEL } from "@/lib/format";

export default async function EventTypesPage() {
  const { host } = await requireHost();
  const types = await listEventTypes(host.id);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Types d'événements</h1>
        <ButtonLink href="/event-types/new">Nouveau type</ButtonLink>
      </div>
      {types.length === 0 ? (
        <EmptyState title="Aucun type d'événement pour l'instant" action={<ButtonLink href="/event-types/new">Créer le premier</ButtonLink>}>
          Un type d'événement décrit un rendez-vous que d'autres peuvent réserver : sa durée, son lieu et ses règles.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {types.map((t) => (
            <li key={t.id}>
              <Card className={`overflow-hidden ${t.active ? "" : "opacity-70"}`}>
                <div className="h-1" style={{ backgroundColor: t.color }} aria-hidden />
                <div className="space-y-3 p-4">
                  <div>
                    <h2 className="break-words">{t.name}</h2>
                    <p className="text-sm text-muted">{t.durationMinutes} min · {LOCATION_LABEL[t.locationKind]}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyLink path={`/${host.username}/${t.slug}`} />
                    <form action={toggleEventTypeAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="active" value={String(!t.active)} />
                      <Button type="submit" variant="ghost" size="sm">{t.active ? "Désactiver" : "Activer"}</Button>
                    </form>
                    <span className="text-sm text-muted">{t.active ? "Actif" : "Inactif"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <ButtonLink href={`/event-types/${t.id}/edit`} variant="secondary" size="sm">Modifier</ButtonLink>
                    <DeleteEventType id={t.id} name={t.name} />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
