// Connexion par Google : règles de liaison, comptes sans mot de passe, courses, état d'inscription. Contre un vrai Postgres.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { resetDb, skip } from "./testdb.ts";

const opts = { skip };
let A: typeof import("./auth-core.ts"), GA: typeof import("./google-auth.ts"), DB: typeof import("./db.ts");
const claims = (over: Partial<{ sub: string; email: string; name: string }> = {}) => ({ sub: "sub-alex", email: "alex@gmail.test", name: "Alex Martin", ...over });
const profile = (over: Partial<{ username: string; displayName: string; timezone: string }> = {}) => ({ username: "alex", displayName: "Alex Martin", timezone: "Europe/Paris", ...over });

before(async () => {
  if (skip) return;
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  DB = await import("./db.ts"); A = await import("./auth-core.ts"); GA = await import("./google-auth.ts");
});
after(async () => { if (!skip) await DB.closePool(); });
beforeEach(async () => { if (!skip) await resetDb(); });

async function localUser(email: string, username: string, verified: boolean, password = "mot-de-passe-solide-1") {
  const r = await A.signUp({ email, password, username, displayName: username, timezone: "UTC" });
  if (r.status !== "created") throw new Error("inscription");
  if (verified) await A.verifyEmail(r.token);
  return r;
}
const count = async (sql: string, p: unknown[] = []) => (await DB.query<{ n: number }>(`select count(*)::int n from ${sql}`, p))[0].n;

test("nouvel utilisateur Google : profil choisi → compte vérifié sans mot de passe, identité liée, disponibilités par défaut", opts, async () => {
  assert.deepEqual(await GA.resolveGoogleLogin(claims()), { status: "new", replacedUnverified: false });
  const r = await GA.completeGoogleSignup(claims(), profile());
  assert.equal(r.status, "created");
  if (r.status !== "created") return;
  const u = (await DB.query<{ email: string; email_verified_at: Date | null; password_set: boolean }>("select email, email_verified_at, password_set from users where id = $1", [r.userId]))[0];
  assert.equal(u.email, "alex@gmail.test");
  assert.ok(u.email_verified_at);
  assert.equal(u.password_set, false);
  assert.equal(await count("availability_rules where user_id = $1", [r.userId]), 5);
  assert.deepEqual(await GA.resolveGoogleLogin(claims()), { status: "ok", userId: r.userId }); // la fois suivante : connexion directe
});

test("l'identité est le « sub », pas l'adresse : si l'adresse change chez Google, on retrouve le même compte", opts, async () => {
  const r = await GA.completeGoogleSignup(claims(), profile());
  const again = await GA.resolveGoogleLogin(claims({ email: "nouvelle-adresse@gmail.test" }));
  assert.equal(again.status, "ok");
  if (r.status === "created" && again.status === "ok") assert.equal(again.userId, r.userId);
  // et une adresse recyclée par quelqu'un d'autre (autre sub) n'ouvre PAS ce compte
  const other = await GA.resolveGoogleLogin(claims({ sub: "sub-intrus", email: "alex@gmail.test" }));
  assert.equal(other.status, "email_in_use");
});

test("compte local VÉRIFIÉ avec la même adresse : jamais de liaison automatique, rien n'est créé", opts, async () => {
  await localUser("alex@gmail.test", "alex-local", true);
  assert.deepEqual(await GA.resolveGoogleLogin(claims()), { status: "email_in_use" });
  assert.equal(await count("user_identities"), 0);
  assert.equal(await count("users"), 1);
  assert.equal((await GA.completeGoogleSignup(claims(), profile())).status, "email_in_use"); // même refus à l'étape finale
  assert.equal(await count("users"), 1);
});

test("pré-détournement : un compte local NON vérifié avec l'adresse de la victime est supprimé, son mot de passe ne sert plus", opts, async () => {
  const attacker = await localUser("alex@gmail.test", "attaquant", false, "mot-de-passe-de-l-attaquant");
  const old = await A.createSession(attacker.status === "created" ? attacker.userId : "");
  const res = await GA.resolveGoogleLogin(claims());
  assert.deepEqual(res, { status: "new", replacedUnverified: true });
  assert.equal(await count("users"), 0, "le compte de l'attaquant n'existe plus");
  assert.equal(await count("profiles"), 0, "ni son nom public");
  assert.equal(await A.getSessionUser(old.token), null);
  assert.equal((await A.checkCredentials("alex@gmail.test", "mot-de-passe-de-l-attaquant")).status, "invalid");
  assert.equal((await A.verifyEmail(attacker.status === "created" ? attacker.token : "")), false, "son lien de vérification est mort");
  const made = await GA.completeGoogleSignup(claims(), profile({ username: "attaquant" })); // la victime peut même reprendre le nom
  assert.equal(made.status, "created");
  assert.equal((await A.checkCredentials("alex@gmail.test", "mot-de-passe-de-l-attaquant")).status, "invalid");
});

test("deux finalisations simultanées du même compte Google : un seul compte", opts, async () => {
  const res = await Promise.all([GA.completeGoogleSignup(claims(), profile()), GA.completeGoogleSignup(claims(), profile({ username: "alex-bis" }))]);
  assert.deepEqual(res.map((r) => r.status).sort(), ["created", "exists"]);
  assert.equal(await count("users"), 1);
  assert.equal(await count("user_identities"), 1);
});

test("un compte local vérifié apparu entre le retour de Google et la fin de l'inscription : refusé", opts, async () => {
  assert.equal((await GA.resolveGoogleLogin(claims())).status, "new");
  await localUser("alex@gmail.test", "alex-local", true);
  assert.equal((await GA.completeGoogleSignup(claims(), profile())).status, "email_in_use");
});

test("nom public déjà pris : refusé, rien n'est créé", opts, async () => {
  await localUser("quelquun@example.com", "alex", true);
  assert.equal((await GA.completeGoogleSignup(claims(), profile({ username: "alex" }))).status, "username_taken");
  assert.equal(await count("user_identities"), 0);
  assert.equal(await count("users"), 1);
  assert.equal(await GA.availableUsername("alex@gmail.test"), "alex-2");
});

test("compte sans mot de passe : la connexion par mot de passe échoue ; « mot de passe oublié » permet d'en définir un", opts, async () => {
  const r = await GA.completeGoogleSignup(claims(), profile());
  if (r.status !== "created") throw new Error("création");
  assert.equal((await A.checkCredentials("alex@gmail.test", "n-importe-quoi-123")).status, "invalid");
  const s = await A.createSession(r.userId);
  const u = (await A.getSessionUser(s.token))!;
  assert.equal(u.hasPassword, false);
  assert.ok(u.sessionAgeSec < 5);
  const reset = (await A.requestPasswordReset("alex@gmail.test"))!;
  assert.ok(await A.resetPassword(reset.token, "nouveau-mot-de-passe-1"));
  assert.equal((await A.checkCredentials("alex@gmail.test", "nouveau-mot-de-passe-1")).status, "ok");
  const s2 = await A.createSession(r.userId);
  assert.equal((await A.getSessionUser(s2.token))!.hasPassword, true);
});

test("liaison depuis le compte : lier, relier idem, compte Google déjà pris, un seul compte Google par utilisateur", opts, async () => {
  const a = await localUser("a@example.com", "aaa", true), b = await localUser("b@example.com", "bbb", true);
  const ida = a.status === "created" ? a.userId : "", idb = b.status === "created" ? b.userId : "";
  assert.equal(await GA.linkGoogle(ida, claims({ email: "autre-adresse@gmail.test" })), "linked", "l'adresse Google peut différer : l'utilisateur est authentifié");
  assert.equal(await GA.linkGoogle(ida, claims()), "already_linked");
  assert.equal(await GA.linkGoogle(idb, claims()), "taken", "ce compte Google appartient à un autre utilisateur");
  assert.equal(await GA.linkGoogle(ida, claims({ sub: "sub-deuxieme" })), "has_other");
  assert.deepEqual(await GA.getGoogleIdentity(ida), { email: "autre-adresse@gmail.test" });
  assert.equal(await GA.getGoogleIdentity(idb), null);
  // lié, il permet de se connecter, y compris avec une adresse Google différente
  assert.deepEqual(await GA.resolveGoogleLogin(claims({ email: "n-importe@gmail.test" })), { status: "ok", userId: ida });
});

test("déliaison : possible avec un mot de passe, refusée pour un compte Google seul (sinon verrouillé dehors)", opts, async () => {
  const a = await localUser("a@example.com", "aaa", true);
  const ida = a.status === "created" ? a.userId : "";
  assert.equal(await GA.unlinkGoogle(ida), "not_linked");
  await GA.linkGoogle(ida, claims());
  assert.equal(await GA.unlinkGoogle(ida), "unlinked");
  assert.equal(await GA.getGoogleIdentity(ida), null);
  const g = await GA.completeGoogleSignup(claims({ sub: "sub-seul", email: "seul@gmail.test" }), profile({ username: "seul" }));
  if (g.status !== "created") throw new Error("création");
  assert.equal(await GA.unlinkGoogle(g.userId), "needs_password");
  assert.ok(await GA.getGoogleIdentity(g.userId));
});

test("suppression d'un compte Google seul : l'adresse exacte est exigée ; avec un mot de passe, pas par cette voie", opts, async () => {
  const g = await GA.completeGoogleSignup(claims(), profile());
  if (g.status !== "created") throw new Error("création");
  assert.equal(await A.deleteAccountPasswordless(g.userId, "mauvaise@gmail.test"), false);
  const pw = await localUser("pw@example.com", "pwuser", true);
  assert.equal(await A.deleteAccountPasswordless(pw.status === "created" ? pw.userId : "", "pw@example.com"), false, "un compte avec mot de passe doit l'utiliser");
  let hooked = false;
  assert.equal(await A.deleteAccountPasswordless(g.userId, " ALEX@gmail.test ", async () => { hooked = true; }), true);
  assert.ok(hooked);
  assert.equal(await count("users where id = $1", [g.userId]), 0);
  assert.equal(await count("user_identities"), 0, "l'identité part avec le compte");
  assert.equal(await count("users"), 1);
});

test("état d'inscription scellé : aller-retour, expiré, falsifié, d'un autre cookie, autre clé", opts, async () => {
  const c = claims();
  const sealed = GA.sealPending(c, 1_000_000);
  assert.deepEqual(GA.openPending(sealed, 1_000_000 + 60_000), c);
  assert.equal(GA.openPending(sealed, 1_000_000 + 16 * 60_000), null, "expiré après 15 minutes");
  assert.equal(GA.openPending(sealed.slice(0, -4) + "AAAA", 1_000_100), null, "falsifié");
  assert.equal(GA.openPending(undefined), null);
  assert.equal(GA.openPending("n'importe quoi"), null);
  const { encryptSecret } = await import("./crypto.ts");
  assert.equal(GA.openPending(encryptSecret(JSON.stringify({ ...c, exp: 9e15 }), "g_oauth")), null, "un chiffré d'un autre usage ne passe pas");
  const old = process.env.TOKEN_ENCRYPTION_KEY;
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  assert.equal(GA.openPending(sealed, 1_000_100), null);
  process.env.TOKEN_ENCRYPTION_KEY = old;
  assert.ok(!sealed.includes("alex@gmail.test"), "l'adresse n'est pas lisible dans le cookie");
});
