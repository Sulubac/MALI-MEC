import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, EmptyState } from "@/components/ui";
import { LOCATION_LABEL } from "@/lib/format";
import { getHostByUsername, listEventTypes } from "@/lib/store";

export default async function HostPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const host = await getHostByUsername(username);
  if (!host) notFound();
  const types = await listEventTypes(host.id, { activeOnly: true });
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">Réserver avec</p>
        <h1>{host.displayName}</h1>
      </div>
      {types.length === 0 ? (
        <EmptyState title="Aucun rendez-vous disponible">{host.displayName} n'a pas de créneau à proposer pour l'instant.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {types.map((t) => (
            <li key={t.id}>
              <Link href={`/${host.username}/${t.slug}`} className="block rounded-lg focus-visible:outline-offset-4">
                <Card className="flex items-stretch overflow-hidden transition-shadow duration-fast hover:shadow-pop">
                  <div className="w-1.5 shrink-0" style={{ backgroundColor: t.color }} aria-hidden />
                  <div className="p-4">
                    <h2 className="break-words">{t.name}</h2>
                    <p className="text-sm text-muted">{t.durationMinutes} min · {LOCATION_LABEL[t.locationKind]}</p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
