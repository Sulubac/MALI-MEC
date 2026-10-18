import type { Metadata } from "next";
import { DeleteAccountForm } from "@/components/AuthForms";
import { Button } from "@/components/ui";
import { logoutEverywhereAction } from "@/app/actions";
import { requireHost } from "@/lib/auth";

export default async function AccountPage() {
  const { user, host } = await requireHost();
  return (
    <div className="space-y-8">
      <h1>Compte</h1>
      <dl className="space-y-1 text-sm">
        <div><dt className="inline text-muted">Adresse e-mail : </dt><dd className="inline break-all">{user.email}</dd></div>
        <div><dt className="inline text-muted">Votre page : </dt><dd className="inline">/{host.username}</dd></div>
      </dl>
      <section className="max-w-md space-y-3">
        <h2 className="text-base">Sessions</h2>
        <p className="text-sm text-muted">Ferme votre session sur tous vos appareils, y compris celui-ci.</p>
        <form action={logoutEverywhereAction}><Button type="submit" variant="secondary">Se déconnecter partout</Button></form>
      </section>
      <DeleteAccountForm />
    </div>
  );
}

export const metadata: Metadata = { title: "Compte" };
