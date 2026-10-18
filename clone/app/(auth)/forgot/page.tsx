import type { Metadata } from "next";
import { ForgotForm } from "@/components/AuthForms";

export default function ForgotPage() {
  return <ForgotForm />;
}

export const metadata: Metadata = { title: "Mot de passe oublié" };
