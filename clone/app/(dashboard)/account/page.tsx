import type { Metadata } from "next";
import { DeleteAccountForm } from "@/components/AuthForms";
import { Button, Notice } from "@/components/ui";
import { linkGoogleAction, logoutEverywhereAction, unlinkGoogleAction } from "@/app/actions";
import { requireHost } from "@/lib/auth";
import { googleConfig } from "@/lib/google";
import { getGoogleIdentity } from "@/lib/google-auth";

export const metadata: Metadata = { title: "Compte" };

const MESSAGES: Record<string, { tone: "success" | "danger"; text: string }> = {
  linked: { tone: "success", text: "Votre compte Google est lié : vous pouvez désormais vous connecter avec." },
  unlinked: { tone: "success", text: "Votre compte Google est délié. Il vous reste votre mot de passe pour vous connecter." },
  needs_password: { tone: "danger", text: "Impossible de délier Google : c'est votre seul moyen de connexion. Définissez d'abord un mot de passe avec « Mot de passe oublié » depuis la page de connexion." },
  google_taken: { tone: "danger", text: "Ce compte Google est déjà lié à un autre compte." },
  google_has_other: { tone: "danger", text: "Un autre compte Google est déjà lié à votre compte. Déliez-le d'abord." },
  google_denied: { tone: "danger", text: "Vous avez refusé l'accès : rien n'a été fait." },
  google_state: { tone: "danger", text: "La demande a expiré ou n'est pas valide. Recommencez." },
  google_failed: { tone: "danger", text: "Google n'a pas pu finaliser la demande. Réessayez dans quelques minutes." },
  google_unverified: { tone: "danger", text: "Google n'a pas confirmé l'adresse e-mail de ce compte : impossible de le lier." },
  google_rate: { tone: "danger", text: "Trop de tentatives. Réessayez dans quelques minutes." },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ linked?: string; unlinked?: string; error?: string }> }) {
  const { user, host } = await requireHost();
  const sp = await searchParams;
  const key = sp.error ?? (sp.linked ? "linked" : sp.unlinked ? "unlinked" : "");
  const msg = Object.hasOwn(MESSAGES, key) ? MESSAGES[key] : undefined;
  const googleEnabled = googleConfig() !== null;
  const identity = await getGoogleIdentity(user.id);
  return (
    <div className="space-y-8">
      <h1>Compte</h1>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <dl className="space-y-1 text-sm">
        <div><dt className="inline text-muted">Adresse e-mail : </dt><dd className="inline break-all">{user.email}</dd></div>
        <div><dt className="inline text-muted">Votre page : </dt><dd className="inline">/{host.username}</dd></div>
      </dl>

      {(googleEnabled || identity) && (
        <section className="wrap-anywhere max-w-md space-y-3">
          <h2 className="text-base">Connexion avec Google</h2>
          {identity ? (
            <>
              <p className="text-sm">Lié au compte Google <span className="font-semibold">{identity.email}</span>.</p>
              {!user.hasPassword && <p className="text-sm text-muted">Vous n'avez pas de mot de passe : Google est votre seul moyen de connexion. Pour pouvoir le délier, définissez un mot de passe avec « Mot de passe oublié » depuis la page de connexion.</p>}
              <form action={unlinkGoogleAction}><Button type="submit" variant="secondary">Délier mon compte Google</Button></form>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Liez votre compte Google pour vous connecter en un clic.</p>
              <form action={linkGoogleAction}><Button type="submit" variant="secondary">Lier mon compte Google</Button></form>
            </>
          )}
        </section>
      )}

      <section className="max-w-md space-y-3">
        <h2 className="text-base">Sessions</h2>
        <p className="text-sm text-muted">Ferme votre session sur tous vos appareils, y compris celui-ci.</p>
        <form action={logoutEverywhereAction}><Button type="submit" variant="secondary">Se déconnecter partout</Button></form>
      </section>
      <DeleteAccountForm hasPassword={user.hasPassword} email={user.email} sessionFresh={user.sessionAgeSec <= 15 * 60} />
    </div>
  );
}
