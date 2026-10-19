import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GoogleSignupForm } from "@/components/AuthForms";
import { currentUser } from "@/lib/auth";
import { availableUsername, GOOGLE_SIGNUP_COOKIE, openPending } from "@/lib/google-auth";

export const metadata: Metadata = { title: "Terminer l'inscription" };

/** Dernière étape après Google : l'identité vérifiée est dans un cookie scellé ; sans lui (ou expiré), on repart de l'inscription. */
export default async function GoogleSignupPage() {
  if (await currentUser()) redirect("/event-types");
  const pending = openPending((await cookies()).get(GOOGLE_SIGNUP_COOKIE)?.value);
  if (!pending) redirect("/signup?error=google_expired");
  return <GoogleSignupForm email={pending.email} defaultName={pending.name} defaultUsername={await availableUsername(pending.email, pending.name)} />;
}
