// Faux serveur Google pour les tests : OAuth (code + PKCE), freeBusy, événements. Reproduit les formes de requête
// et de réponse de l'API Google telles que l'application les utilise, et refuse les requêtes mal formées.
// ATTENTION : c'est ma lecture de la documentation Google, pas Google. Il ne remplace pas un essai avec de vrais identifiants.
import { createHash, randomBytes } from "node:crypto";
import http from "node:http";

type Ev = { id: string; summary?: string; description?: string; location?: string; start: { dateTime: string }; end: { dateTime: string }; transparency?: string };
type Cal = { busy: { start: number; end: number }[]; events: Map<string, Ev>; deleted: Set<string> };
type Opts = {
  consent: "approve" | "deny"; deniedScopes: string[]; noRefreshToken: boolean; loginEmail: string;
  loginSub: string; loginName: string; emailVerified: boolean | "true"; idTokenAudience: string; nonceMode: "ok" | "wrong" | "missing"; idTokenExpired: boolean; idTokenIssuer: string;
};
const DEFAULT_OPTS: Opts = { consent: "approve", deniedScopes: [], noRefreshToken: false, loginEmail: "host@gmail.test", loginSub: "", loginName: "Alex Martin", emailVerified: true, idTokenAudience: "", nonceMode: "ok", idTokenExpired: false, idTokenIssuer: "https://accounts.google.com" };

export const FAKE = { clientId: "client-test.apps.example", clientSecret: "secret-test" };

export function startFakeGoogle(port: number): Promise<{ close: () => Promise<void>; url: string }> {
  const codes = new Map<string, { email: string; scopes: string[]; challenge: string; redirect: string; nonce: string; offline: boolean; sub: string }>();
  const refresh = new Map<string, { email: string; scopes: string[]; revoked: boolean }>();
  const access = new Map<string, { email: string; scopes: string[]; exp: number }>();
  const cals = new Map<string, Cal>();
  const log: string[] = [];
  let opts: Opts = { ...DEFAULT_OPTS };
  let fails: { target: string; status: number; times: number }[] = [];
  let delays: { target: string; ms: number; times: number }[] = [];
  const cal = (email: string) => { if (!cals.has(email)) cals.set(email, { busy: [], events: new Map(), deleted: new Set() }); return cals.get(email)!; };

  const send = (res: http.ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };
  const readBody = (req: http.IncomingMessage) => new Promise<string>((ok) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => ok(d)); });
  const takeDelay = (target: string) => { const d = delays.find((x) => x.target === target && x.times > 0); if (d) { d.times--; return d.ms; } return 0; };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const takeFail = (target: string) => { const f = fails.find((x) => x.target === target && x.times > 0); if (f) { f.times--; return f.status; } return 0; };
  const gErr = (status: number, message: string) => ({ error: { code: status, message } });

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const path = u.pathname;
    const body = req.method === "GET" ? "" : await readBody(req);
    log.push(`${req.method} ${path}`);

    // ----- commandes de test -----
    if (path === "/__control/reset") { codes.clear(); refresh.clear(); access.clear(); cals.clear(); log.length = 0; fails = []; delays = []; opts = { ...DEFAULT_OPTS }; return send(res, 200, {}); }
    if (path === "/__control/options") { opts = { ...opts, ...JSON.parse(body) }; return send(res, 200, opts); }
    if (path === "/__control/busy") { const b = JSON.parse(body); cal(b.email).busy.push({ start: Date.parse(b.start), end: Date.parse(b.end) }); return send(res, 200, {}); }
    if (path === "/__control/fail") { fails.push(JSON.parse(body)); return send(res, 200, {}); }
    if (path === "/__control/delay") { delays.push(JSON.parse(body)); return send(res, 200, {}); }
    if (path === "/__control/revoke-all") { const { email } = JSON.parse(body); for (const r of refresh.values()) if (r.email === email) r.revoked = true; for (const [k, a] of access) if (a.email === email) access.delete(k); return send(res, 200, {}); }
    if (path === "/__control/expire-access") { access.clear(); return send(res, 200, {}); }
    if (path === "/__control/state") {
      const email = u.searchParams.get("email") ?? opts.loginEmail; const c = cal(email);
      return send(res, 200, { events: [...c.events.values()], deleted: [...c.deleted], log, refreshTokens: [...refresh.values()].filter((r) => r.email === email).map((r) => ({ revoked: r.revoked })) });
    }

    // ----- OAuth -----
    if (path === "/auth" && req.method === "GET") {
      const q = u.searchParams;
      if (q.get("client_id") !== FAKE.clientId) return send(res, 400, { error: "invalid_client" });
      if (q.get("response_type") !== "code" || q.get("code_challenge_method") !== "S256" || !q.get("code_challenge") || !q.get("state") || !q.get("redirect_uri")) return send(res, 400, { error: "invalid_request" });
      const requestedScopes = (q.get("scope") ?? "").split(" ");
      const wantsCalendar = requestedScopes.some((x) => x.includes("/auth/calendar"));
      if (wantsCalendar && (q.get("access_type") !== "offline" || q.get("prompt") !== "consent")) return send(res, 400, { error: "refresh token non demandé" });
      if (!wantsCalendar) { // connexion : identité seulement, nonce obligatoire, choix du compte, pas d'accès hors ligne
        if (!q.get("nonce") || q.get("prompt") !== "select_account" || q.get("access_type")) return send(res, 400, { error: "demande de connexion mal formée" });
        if (requestedScopes.some((x) => !["openid", "email", "profile"].includes(x))) return send(res, 400, { error: "portées inattendues pour une connexion" });
      }
      const redirect = new URL(q.get("redirect_uri")!);
      redirect.searchParams.set("state", q.get("state")!);
      if (opts.consent === "deny") redirect.searchParams.set("error", "access_denied");
      else {
        const requested = (q.get("scope") ?? "").split(" ");
        const granted = requested.filter((s) => !opts.deniedScopes.includes(s));
        const code = randomBytes(12).toString("hex");
        codes.set(code, { email: opts.loginEmail, scopes: granted, challenge: q.get("code_challenge")!, redirect: q.get("redirect_uri")!, nonce: q.get("nonce") ?? "", offline: q.get("access_type") === "offline", sub: opts.loginSub || `sub-${createHash("sha1").update(opts.loginEmail).digest("hex").slice(0, 12)}` });
        redirect.searchParams.set("code", code);
      }
      res.writeHead(302, { location: redirect.toString() }); return res.end();
    }

    if (path === "/token" && req.method === "POST") {
      const status = takeFail("token"); if (status) return send(res, status, { error: "temporarily_unavailable" });
      const f = new URLSearchParams(body);
      if (f.get("client_id") !== FAKE.clientId || f.get("client_secret") !== FAKE.clientSecret) return send(res, 401, { error: "invalid_client" });
      const issue = (email: string, scopes: string[], withRefresh: string | null, c?: { nonce: string; sub: string }) => {
        const tok = "ya29." + randomBytes(12).toString("hex");
        access.set(tok, { email, scopes, exp: Date.now() + 3599_000 });
        const claims: Record<string, unknown> = {
          iss: opts.idTokenIssuer, aud: opts.idTokenAudience || FAKE.clientId, sub: c?.sub ?? `sub-${createHash("sha1").update(email).digest("hex").slice(0, 12)}`, email,
          email_verified: opts.emailVerified, name: opts.loginName, iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (opts.idTokenExpired ? -3600 : 3600),
        };
        if (c && opts.nonceMode !== "missing") claims.nonce = opts.nonceMode === "wrong" ? "autre-nonce" : c.nonce;
        const idToken = ["x", Buffer.from(JSON.stringify(claims)).toString("base64url"), "y"].join(".");
        return { access_token: tok, expires_in: 3599, scope: scopes.join(" "), token_type: "Bearer", id_token: idToken, ...(withRefresh ? { refresh_token: withRefresh } : {}) };
      };
      if (f.get("grant_type") === "authorization_code") {
        const c = codes.get(f.get("code") ?? "");
        if (!c) return send(res, 400, { error: "invalid_grant", error_description: "Bad Request" });
        codes.delete(f.get("code")!); // un code ne sert qu'une fois
        if (f.get("redirect_uri") !== c.redirect) return send(res, 400, { error: "redirect_uri_mismatch" });
        if (createHash("sha256").update(f.get("code_verifier") ?? "").digest("base64url") !== c.challenge) return send(res, 400, { error: "invalid_grant", error_description: "Missing code verifier / mismatch" });
        let rt: string | null = null;
        if (c.offline && !opts.noRefreshToken) { rt = "1//" + randomBytes(16).toString("hex"); refresh.set(rt, { email: c.email, scopes: c.scopes, revoked: false }); }
        return send(res, 200, issue(c.email, c.scopes, rt, { nonce: c.nonce, sub: c.sub }));
      }
      if (f.get("grant_type") === "refresh_token") {
        const r = refresh.get(f.get("refresh_token") ?? "");
        if (!r || r.revoked) return send(res, 400, { error: "invalid_grant", error_description: "Token has been expired or revoked." });
        return send(res, 200, issue(r.email, r.scopes, null));
      }
      return send(res, 400, { error: "unsupported_grant_type" });
    }

    if (path === "/revoke" && req.method === "POST") {
      const t = new URLSearchParams(body).get("token") ?? "";
      const r = refresh.get(t); if (r) r.revoked = true;
      return send(res, 200, {});
    }

    // ----- API Calendar -----
    if (path.startsWith("/calendar/v3/")) {
      const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
      const a = m ? access.get(m[1]) : undefined;
      if (!a || a.exp < Date.now()) return send(res, 401, gErr(401, "Invalid Credentials"));
      const c = cal(a.email);
      const rest = path.slice("/calendar/v3".length);

      if (rest === "/freeBusy" && req.method === "POST") {
        { const d = takeDelay("freebusy"); if (d) await sleep(d); }
        const status = takeFail("freebusy"); if (status) return send(res, status, gErr(status, "Backend Error"));
        const j = JSON.parse(body);
        if (!j.timeMin || !j.timeMax || !Array.isArray(j.items) || !j.items.length) return send(res, 400, gErr(400, "Required"));
        const from = Date.parse(j.timeMin), to = Date.parse(j.timeMax);
        const busy = [...c.busy, ...[...c.events.values()].filter((e) => e.transparency !== "transparent").map((e) => ({ start: Date.parse(e.start.dateTime), end: Date.parse(e.end.dateTime) }))]
          .filter((b) => b.end > from && b.start < to).map((b) => ({ start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString() }));
        return send(res, 200, { kind: "calendar#freeBusy", timeMin: j.timeMin, timeMax: j.timeMax, calendars: Object.fromEntries(j.items.map((i: { id: string }) => [i.id, { busy }])) });
      }
      if (rest === "/calendars/primary/events" && req.method === "POST") {
        const status = takeFail("events"); if (status) return send(res, status, gErr(status, "Backend Error"));
        const j = JSON.parse(body) as Ev;
        if (!/^[a-v0-9]{5,1024}$/.test(j.id ?? "")) return send(res, 400, gErr(400, "Invalid resource id value."));
        if (!j.start?.dateTime || !j.end?.dateTime || !j.summary) return send(res, 400, gErr(400, "Missing summary/start/end"));
        if (u.searchParams.get("sendUpdates") !== "none") return send(res, 400, gErr(400, "sendUpdates=none attendu : aucun envoi automatique"));
        if (c.events.has(j.id) || c.deleted.has(j.id)) return send(res, 409, gErr(409, "The requested identifier already exists."));
        c.events.set(j.id, j);
        return send(res, 200, { kind: "calendar#event", status: "confirmed", ...j });
      }
      const del = /^\/calendars\/primary\/events\/([^/]+)$/.exec(rest);
      if (del && req.method === "DELETE") {
        const status = takeFail("events"); if (status) return send(res, status, gErr(status, "Backend Error"));
        const id = decodeURIComponent(del[1]);
        if (c.events.has(id)) { c.events.delete(id); c.deleted.add(id); res.writeHead(204); return res.end(); }
        return send(res, c.deleted.has(id) ? 410 : 404, gErr(c.deleted.has(id) ? 410 : 404, c.deleted.has(id) ? "Resource has been deleted" : "Not Found"));
      }
    }
    send(res, 404, gErr(404, `route inconnue ${req.method} ${path}`));
  });

  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok({
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((done) => { server.closeAllConnections(); server.close(() => done()); }),
  })));
}
