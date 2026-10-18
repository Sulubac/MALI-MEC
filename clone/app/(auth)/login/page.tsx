import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { currentUser } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ verified?: string; reset?: string }> }) {
  if (await currentUser()) redirect("/event-types");
  const sp = await searchParams;
  return <LoginForm notice={sp.verified ? "verified" : sp.reset ? "reset" : undefined} />;
}
