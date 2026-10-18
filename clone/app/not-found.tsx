import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="contenu" className="mx-auto max-w-content px-4 py-16">
      <EmptyState title="Page introuvable" action={<ButtonLink href="/event-types" variant="secondary">Retour à l'accueil</ButtonLink>}>
        Ce lien n'existe pas ou n'est plus actif.
      </EmptyState>
    </main>
  );
}
