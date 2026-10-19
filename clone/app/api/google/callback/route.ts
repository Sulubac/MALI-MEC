import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { saveConnection } from "@/lib/calendar";
import { currentUser } from "@/lib/auth";
import { appUrl } from "@/lib/email";
import { canReadBusy, exchangeCode, GOOGLE_OAUTH_COOKIE, GoogleError, googleConfig } from "@/lib/google";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** Retour de Google : vérifie l'état (CSRF) et l'utilisateur, échange le code (PKCE), enregistre la connexion chiffrée. */
export async function GET(req: Request) {
  const done = (query: string) => {
    const res = NextResponse.redirect(appUrl(`/integrations?${query}`));
    res.cookies.set(GOOGLE_OAUTH_COOKIE, "", { path: "/api/google", maxAge: 0 });
    return res;
  };
  const user = await currentUser();
  if (!user) return NextResponse.redirect(appUrl("/login"));

  const url = new URL(req.url);
  let saved: { state: string; verifier: string; userId: string; exp: number } | null = null;
  try {
    const raw = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${GOOGLE_OAUTH_COOKIE}=`))?.slice(GOOGLE_OAUTH_COOKIE.length + 1);
    saved = raw ? JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) : null;
  } catch { saved = null; }
  const state = url.searchParams.get("state") ?? "";
  if (!saved || saved.exp < Date.now() || saved.userId !== user.id || !state || !same(saved.state, state)) return done("error=state");

  if (url.searchParams.get("error")) return done(url.searchParams.get("error") === "access_denied" ? "error=denied" : "error=google");
  const code = url.searchParams.get("code");
  const cfg = googleConfig();
  if (!code) return done("error=google");
  if (!cfg) return done("error=not_configured");

  try {
    const t = await exchangeCode(cfg, code, saved.verifier);
    if (!t.refreshToken) return done("error=no_refresh");
    if (!canReadBusy(t.scopes)) return done("error=scope");
    const { canWrite } = await saveConnection(user.id, { ...t, refreshToken: t.refreshToken });
    return done(canWrite ? "connected=1" : "connected=readonly");
  } catch (e) {
    console.error("connexion Google :", e instanceof GoogleError ? `${e.kind} ${e.status ?? ""}` : "erreur inattendue"); // pas de détail brut : il peut citer des jetons
    return done("error=google");
  }
}
