import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/AuthForms";
import { currentUser } from "@/lib/auth";
import { authMessage } from "@/lib/auth-messages";
import { googleConfig } from "@/lib/google";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ deleted?: string; error?: string }> }) {
  if (await currentUser()) redirect("/event-types");
  const sp = await searchParams;
  return <SignupForm deleted={!!sp.deleted} googleEnabled={googleConfig() !== null} errorText={authMessage(sp.error)} />;
}

export const metadata: Metadata = { title: "Créer un compte" };
