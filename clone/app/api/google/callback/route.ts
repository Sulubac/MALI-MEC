import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { saveConnection } from "@/lib/calendar";
import { currentUser, startSessionOn } from "@/lib/auth";
import { appUrl } from "@/lib/email";
import { linkGoogle, GOOGLE_SIGNUP_COOKIE, resolveGoogleLogin, sealPending } from "@/lib/google-auth";
import { canReadBusy, checkIdToken, exchangeCode, GOOGLE_LOGIN_COOKIE, GOOGLE_OAUTH_COOKIE, GoogleError, googleConfig } from "@/lib/google";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

function readCookie<T>(req: Request, name: string): T | null {
  try {
    const raw = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
    return raw ? (JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as T) : null;
  } catch { return null; }
}

type LoginCookie = { state: string; verifier: string; nonce: string; purpose: "login" | "link"; userId?: string; exp: number };
type CalendarCookie = { state: string; verifier: string; userId: string; exp: number };

/**
 * Retour de Google. Une seule adresse de retour est déclarée dans la console Google : on distingue les deux usages par le cookie
 * dont l'état correspond à celui de la requête (« g_login » : connexion ou liaison du compte ; « g_oauth » : connexion de l'agenda).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const login = readCookie<LoginCookie>(req, GOOGLE_LOGIN_COOKIE);
  if (login && state && same(login.state, state)) return signInFlow(url, login);
  const cal = readCookie<CalendarCookie>(req, GOOGLE_OAUTH_COOKIE);
  if (cal && state && same(cal.state, state)) return calendarFlow(url, cal);

  // Aucun cookie ne correspond : retour périmé, rejoué ou falsifié.
  const user = await currentUser();
  return NextResponse.redirect(appUrl(user ? "/integrations?error=state" : "/login?error=google_state"));
}

// ---------- Connexion et liaison du compte ----------
async function signInFlow(url: URL, saved: LoginCookie) {
  const to = (path: string) => {
    const res = NextResponse.redirect(appUrl(path));
    res.cookies.set(GOOGLE_LOGIN_COOKIE, "", { path: "/api/google", maxAge: 0 });
    return res;
  };
  const back = saved.purpose === "link" ? "/account" : "/login";
  const fail = (code: string) => to(`${back}?error=${code}`);

  if (saved.exp < Date.now()) return fail("google_state");
  if (url.searchParams.get("error")) return fail(url.searchParams.get("error") === "access_denied" ? "google_denied" : "google_failed");
  const code = url.searchParams.get("code");
  const cfg = googleConfig();
  if (!code || !cfg) return fail("google_failed");

  let claims;
  try {
    const t = await exchangeCode(cfg, code, saved.verifier);
    const check = checkIdToken(t.idToken, { clientId: cfg.clientId, nonce: saved.nonce });
    if (!check.ok) return fail(check.reason === "email_unverified" ? "google_unverified" : "google_failed");
    claims = check.claims;
  } catch (e) {
    console.error("connexion par Google :", e instanceof GoogleError ? `${e.kind} ${e.status ?? ""}` : "erreur inattendue"); // jamais de détail brut : il peut citer des jetons
    return fail("google_failed");
  }

  if (saved.purpose === "link") {
    const user = await currentUser();
    if (!user || user.id !== saved.userId) return to("/login?error=google_state");
    const r = await linkGoogle(user.id, claims);
    return to(r === "linked" || r === "already_linked" ? "/account?linked=1" : r === "taken" ? "/account?error=google_taken" : "/account?error=google_has_other");
  }

  const r = await resolveGoogleLogin(claims);
  if (r.status === "email_in_use") return to("/login?error=google_exists");
  if (r.status === "ok") {
    const res = to("/event-types");
    await startSessionOn(res, r.userId);
    return res;
  }
  // Nouvel utilisateur : l'identité vérifiée est gardée (chiffrée, 15 minutes) le temps de choisir son profil ; rien n'est créé avant.
  const res = to("/signup/google");
  res.cookies.set(GOOGLE_SIGNUP_COOKIE, sealPending(claims), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/signup", maxAge: 900 });
  return res;
}

// ---------- Connexion de l'agenda (inchangé) ----------
async function calendarFlow(url: URL, saved: CalendarCookie) {
  const done = (query: string) => {
    const res = NextResponse.redirect(appUrl(`/integrations?${query}`));
    res.cookies.set(GOOGLE_OAUTH_COOKIE, "", { path: "/api/google", maxAge: 0 });
    return res;
  };
  const user = await currentUser();
  if (!user) return NextResponse.redirect(appUrl("/login"));
  if (saved.exp < Date.now() || saved.userId !== user.id) return done("error=state");

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
    console.error("connexion Google :", e instanceof GoogleError ? `${e.kind} ${e.status ?? ""}` : "erreur inattendue");
    return done("error=google");
  }
}
