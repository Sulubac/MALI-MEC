import { ResetForm } from "@/components/AuthForms";
import { getEmailTokenStatus } from "@/lib/auth-core";
import { Notice } from "@/components/ui";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  if (!token || !(await getEmailTokenStatus(token, "reset_password"))) {
    return <Notice>Ce lien est invalide ou a expiré. Refaites une demande depuis « Mot de passe oublié ».</Notice>;
  }
  return <ResetForm token={token} />;
}
