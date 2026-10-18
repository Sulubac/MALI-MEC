// Liaison avec Next : cookie de session, utilisateur courant, garde des pages.
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSession, deleteSession, getSessionUser, type AuthUser } from "./auth-core.ts";
import { getHostById } from "./store.ts";
import type { Host } from "./types.ts";

const secure = () => process.env.NODE_ENV === "production";
// Préfixe __Host- : cookie lié à ce domaine seul, Secure, sans Domain (impossible à écraser par un sous-domaine)
const cookieName = () => (secure() ? "__Host-sid" : "sid");

export const currentUser = cache(async (): Promise<AuthUser | null> => {
  const token = (await cookies()).get(cookieName())?.value;
  return token ? getSessionUser(token) : null;
});

export async function requireUser(): Promise<AuthUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireHost(): Promise<{ user: AuthUser; host: Host }> {
  const user = await requireUser();
  const host = await getHostById(user.id);
  if (!host) redirect("/login");
  return { user, host };
}

export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await createSession(userId);
  (await cookies()).set(cookieName(), token, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", expires: expiresAt });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(cookieName())?.value;
  if (token) await deleteSession(token);
  jar.delete(cookieName());
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(cookieName());
}

/** Adresse du client. Derrière un proxy de confiance (Vercel, etc.), x-forwarded-for est posé par la plateforme. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "inconnue";
}
