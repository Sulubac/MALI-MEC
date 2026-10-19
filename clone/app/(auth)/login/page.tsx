import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { currentUser } from "@/lib/auth";
import { authMessage } from "@/lib/auth-messages";
import { googleConfig } from "@/lib/google";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ verified?: string; reset?: string; error?: string }> }) {
  if (await currentUser()) redirect("/event-types");
  const sp = await searchParams;
  return <LoginForm notice={sp.verified ? "verified" : sp.reset ? "reset" : undefined} googleEnabled={googleConfig() !== null} errorText={authMessage(sp.error)} />;
}

export const metadata: Metadata = { title: "Connexion" };
