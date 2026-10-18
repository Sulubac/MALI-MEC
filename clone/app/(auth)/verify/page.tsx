import type { Metadata } from "next";
import { VerifyForm } from "@/components/AuthForms";
import { getEmailTokenStatus } from "@/lib/auth-core";

// Le jeton n'est consommé que par le clic sur le bouton : les analyseurs de liens des messageries ne l'« usent » pas.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <VerifyForm token={token} valid={!!token && (await getEmailTokenStatus(token, "verify_email"))} />;
}

export const metadata: Metadata = { title: "Confirmer votre adresse" };
