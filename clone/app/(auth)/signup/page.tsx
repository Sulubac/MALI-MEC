import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/AuthForms";
import { currentUser } from "@/lib/auth";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  if (await currentUser()) redirect("/event-types");
  const sp = await searchParams;
  return <SignupForm deleted={!!sp.deleted} />;
}

export const metadata: Metadata = { title: "Créer un compte" };
