// Connexion par Google (S01). L'application parle au faux Google (e2e/fake-google.ts) : ces tests vérifient NOTRE code
// (règles de liaison, cookies, états d'erreur), pas le comportement du vrai Google, qui reste à valider avec de vrais identifiants.
import { randomUUID } from "node:crypto";
import { test, expect, expectAccessible } from "./fixtures.ts";
import { login, makeHost, newContext, PASSWORD, sql, waitForMail } from "./helpers.ts";

const G = "http://127.0.0.1:3199";
const control = (path: string, body: unknown = {}) => fetch(`${G}/__control/${path}`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());
const uniq = () => `g${randomUUID().slice(0, 8)}@gmail.test`;
type Page = import("@playwright/test").Page;

test.beforeEach(async () => { await control("reset"); });

/** Joue « Continuer avec Google » sur la page de connexion. */
async function googleLogin(page: Page, path = "/login", label = "Continuer avec Google") {
  await page.goto(path);
  await page.getByRole("button", { name: label }).click();
}
/** Parcours d'un nouvel utilisateur jusqu'au tableau de bord. */
async function newGoogleUser(page: Page, opts: { email?: string; name?: string; username?: string } = {}) {
  const email = opts.email ?? uniq();
  await control("options", { loginEmail: email, loginName: opts.name ?? "Alex Martin" });
  await googleLogin(page);
  await page.waitForURL("**/signup/google");
  if (opts.username) await page.getByLabel(/Nom dans votre lien/).fill(opts.username);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/event-types");
  return email;
}

test.describe("S01 connexion par Google", () => {
  test("GS-H1 nouvel utilisateur : consentement, profil prérempli, compte vérifié sans mot de passe, session sécurisée", async ({ page, context }) => {
    const email = uniq();
    await control("options", { loginEmail: email, loginName: "Alex Martin" });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeVisible();
    await page.getByRole("button", { name: "Continuer avec Google" }).click();
    await page.waitForURL("**/signup/google");
    await expect(page.getByRole("heading", { name: "Terminer votre inscription" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByLabel("Votre nom")).toHaveValue("Alex Martin");
    await expect(page.getByLabel(/Nom dans votre lien/)).toHaveValue(email.split("@")[0]);
    const pending = (await context.cookies()).find((c) => c.name === "g_signup")!;
    expect(pending).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/signup" });
    expect(pending.value, "l'identité n'est pas lisible dans le cookie").not.toContain(email.split("@")[0]);
    expect(await sql("select 1 from users where lower(email) = $1", [email]), "rien n'est créé avant la fin du profil").toHaveLength(0);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL("**/event-types");
    const sid = (await context.cookies()).find((c) => /sid/.test(c.name))!;
    expect(sid).toMatchObject({ name: "__Host-sid", httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    expect((await context.cookies()).find((c) => c.name === "g_signup"), "cookie d'inscription supprimé").toBeUndefined();
    const u = (await sql<{ email_verified_at: Date | null; password_set: boolean }>("select email_verified_at, password_set from users where lower(email) = $1", [email]))[0];
    expect(u.email_verified_at).not.toBeNull();
    expect(u.password_set).toBe(false);
    expect(await sql("select 1 from user_identities where email = $1", [email])).toHaveLength(1);
    await page.goto("/account");
    await expect(page.getByText(`Lié au compte Google`)).toBeVisible();
    await expect(page.getByText(/Vous n'avez pas de mot de passe/).first()).toBeVisible();
  });

  test("GS-H2 utilisateur déjà inscrit : connexion directe, sans nouvelle étape ni doublon", async ({ page }) => {
    const email = await newGoogleUser(page);
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await page.waitForURL("**/login");
    await googleLogin(page);
    await page.waitForURL("**/event-types");
    expect(await sql("select 1 from users where lower(email) = $1", [email])).toHaveLength(1);
  });

  test("GS-H3 depuis la page d'inscription : même parcours", async ({ page }) => {
    await control("options", { loginEmail: uniq() });
    await googleLogin(page, "/signup", "S'inscrire avec Google");
    await page.waitForURL("**/signup/google");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL("**/event-types");
  });

  test("GS-E1 compte local VÉRIFIÉ avec la même adresse : pas de liaison automatique, message clair ; liaison explicite après mot de passe", async ({ page }) => {
    const h = await makeHost();
    await control("options", { loginEmail: h.email });
    await googleLogin(page);
    await expect(page.getByText(/Un compte existe déjà avec l'adresse e-mail de ce compte Google/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect(await sql("select 1 from user_identities where user_id = $1", [h.host.id]), "aucune liaison automatique").toHaveLength(0);
    expect(await sql("select 1 from users where lower(email) = $1", [h.email])).toHaveLength(1);
    // connexion par mot de passe, puis liaison depuis la page Compte
    await login(page, h.email);
    await page.goto("/account");
    await page.getByRole("button", { name: "Lier mon compte Google" }).click();
    await expect(page.getByText("Votre compte Google est lié")).toBeVisible();
    await page.getByRole("button", { name: "Se déconnecter", exact: true }).click();
    await page.waitForURL("**/login");
    await googleLogin(page);
    await page.waitForURL("**/event-types");
    const rows = await sql<{ n: number }>("select count(*)::int n from users where lower(email) = $1", [h.email]);
    expect(rows[0].n).toBe(1);
  });

  test("GS-E2 pré-détournement : un compte non vérifié avec l'adresse de la victime disparaît, son mot de passe ne sert plus", async ({ page, browser }) => {
    const email = uniq();
    const attacker = await (await newContext(browser)).newPage();
    await attacker.goto("/signup");
    await attacker.getByLabel("Votre nom").fill("Intrus");
    await attacker.getByLabel(/Nom dans votre lien/).fill(`intrus${Date.now().toString(36)}`);
    await attacker.getByLabel("Adresse e-mail").fill(email);
    await attacker.getByLabel("Mot de passe").fill("mot-de-passe-de-l-attaquant");
    await attacker.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(attacker.getByRole("heading", { name: "Vérifiez votre boîte e-mail" })).toBeVisible();
    expect(await sql("select 1 from users where lower(email) = $1", [email])).toHaveLength(1);
    // la vraie propriétaire de l'adresse se connecte avec Google
    await control("options", { loginEmail: email });
    await googleLogin(page);
    await page.waitForURL("**/signup/google");
    expect(await sql("select 1 from users where lower(email) = $1", [email]), "le compte de l'attaquant est supprimé").toHaveLength(0);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL("**/event-types");
    // le mot de passe de l'attaquant ne donne rien
    const other = await (await newContext(browser)).newPage();
    await other.goto("/login");
    await other.getByLabel("Adresse e-mail").fill(email);
    await other.getByLabel("Mot de passe").fill("mot-de-passe-de-l-attaquant");
    await other.getByRole("button", { name: "Se connecter" }).click();
    await expect(other.getByText("Adresse ou mot de passe incorrect")).toBeVisible();
    // le lien de vérification envoyé à l'attaquant est mort
    const [mail] = await waitForMail("to_address = $1", [email]);
    await other.goto(mail.body_text.match(/http\S+/)![0]);
    await expect(other.getByText("invalide ou a expiré").first()).toBeVisible();
  });

  test("GS-E3 consentement refusé : message clair, aucune session ni compte", async ({ page }) => {
    const email = uniq();
    await control("options", { consent: "deny", loginEmail: email });
    await googleLogin(page);
    await expect(page.getByText("Vous avez refusé l'accès")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect(await sql("select 1 from users where lower(email) = $1", [email])).toHaveLength(0);
    await page.goto("/event-types");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("GS-E4 jeton d'identité invalide (adresse non vérifiée, nonce, destinataire, expiré, émetteur) : refusé, rien n'est créé", async ({ page }) => {
    const cases: [string, Record<string, unknown>, RegExp][] = [
      ["adresse non confirmée par Google", { emailVerified: false }, /n'a pas confirmé l'adresse e-mail/],
      ["nonce différent", { nonceMode: "wrong" }, /n'a pas pu finaliser/],
      ["nonce absent", { nonceMode: "missing" }, /n'a pas pu finaliser/],
      ["destinataire différent", { idTokenAudience: "un-autre-client" }, /n'a pas pu finaliser/],
      ["jeton expiré", { idTokenExpired: true }, /n'a pas pu finaliser/],
      ["émetteur inconnu", { idTokenIssuer: "https://evil.example" }, /n'a pas pu finaliser/],
    ];
    for (const [name, opts, msg] of cases) {
      const email = uniq();
      await control("reset");
      await control("options", { loginEmail: email, ...opts });
      await googleLogin(page);
      await expect(page.getByText(msg), name).toBeVisible();
      await expect(page, name).toHaveURL(/\/login/);
      expect(await sql("select 1 from users where lower(email) = $1", [email]), name).toHaveLength(0);
    }
  });

  test("GS-E5 retour falsifié, périmé ou rejoué : refusé, aucun compte, aucune session", async ({ page, context }) => {
    // sans cookie
    await page.goto("/api/google/callback?code=abc&state=xyz");
    await expect(page.getByText("La demande de connexion a expiré ou n'est pas valide")).toBeVisible();
    // état falsifié
    await page.goto("/login");
    await page.route(`${G}/auth*`, (route) => route.fulfill({ status: 302, headers: { location: "http://localhost:3100/api/google/callback?code=abc&state=falsifie" } }));
    await page.getByRole("button", { name: "Continuer avec Google" }).click();
    await expect(page.getByText("La demande de connexion a expiré ou n'est pas valide")).toBeVisible();
    await page.unroute(`${G}/auth*`);
    // rejeu de l'adresse de retour d'une connexion réussie
    const email = uniq();
    await control("options", { loginEmail: email });
    let callback = "";
    page.on("request", (r) => { if (r.url().includes("/api/google/callback")) callback = r.url(); });
    await googleLogin(page);
    await page.waitForURL("**/signup/google");
    await context.clearCookies({ name: "g_signup" });
    await page.goto(callback);
    await expect(page.getByText("La demande de connexion a expiré ou n'est pas valide")).toBeVisible();
    expect((await context.cookies()).find((c) => /sid/.test(c.name)), "aucune session").toBeUndefined();
  });

  test("GS-E6 inscription en cours expirée ou absente : retour à l'inscription avec un message", async ({ page, context }) => {
    await page.goto("/signup/google");
    await expect(page).toHaveURL(/\/signup\?error=google_expired/);
    await expect(page.getByText("L'inscription avec Google a expiré")).toBeVisible();
    await control("options", { loginEmail: uniq() });
    await googleLogin(page);
    await page.waitForURL("**/signup/google");
    await context.clearCookies({ name: "g_signup" }); // simule l'expiration
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL(/\/signup\?error=google_expired/);
    await expect(page.getByText("L'inscription avec Google a expiré")).toBeVisible();
  });

  test("GS-E7 profil : nom réservé ou déjà pris refusés en gardant la saisie ; « Annuler » supprime l'inscription en cours", async ({ page, context }) => {
    const h = await makeHost();
    await control("options", { loginEmail: uniq() });
    await googleLogin(page);
    await page.waitForURL("**/signup/google");
    await page.getByLabel("Votre nom").fill("Nom Choisi");
    await page.getByLabel(/Nom dans votre lien/).fill("account");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByText("Ce nom est réservé")).toBeVisible();
    await expect(page.getByLabel("Votre nom")).toHaveValue("Nom Choisi");
    await page.getByLabel(/Nom dans votre lien/).fill(h.username);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByText("Ce nom est déjà pris.")).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).click();
    await page.waitForURL("**/signup");
    expect((await context.cookies()).find((c) => c.name === "g_signup")).toBeUndefined();
    await page.goto("/signup/google");
    await expect(page).toHaveURL(/error=google_expired/);
  });

  test("GS-E8 compte sans mot de passe : la connexion par mot de passe échoue ; « mot de passe oublié » en crée un, puis Google peut être délié", async ({ page, browser }) => {
    const email = await newGoogleUser(page);
    const pw = await (await newContext(browser)).newPage();
    await pw.goto("/login");
    await pw.getByLabel("Adresse e-mail").fill(email);
    await pw.getByLabel("Mot de passe").fill("un-mot-de-passe-quelconque");
    await pw.getByRole("button", { name: "Se connecter" }).click();
    await expect(pw.getByText("Adresse ou mot de passe incorrect")).toBeVisible();
    // déliaison refusée : seul moyen de connexion
    await page.goto("/account");
    await page.getByRole("button", { name: "Délier mon compte Google" }).click();
    await expect(page.getByText(/Impossible de délier Google/)).toBeVisible();
    expect(await sql("select 1 from user_identities where email = $1", [email])).toHaveLength(1);
    // définir un mot de passe par « mot de passe oublié »
    await pw.goto("/forgot");
    await pw.getByLabel("Adresse e-mail").fill(email);
    await pw.getByRole("button", { name: "Envoyer le lien" }).click();
    const [m] = await waitForMail("to_address = $1 and subject like 'Choisissez%'", [email]);
    await pw.goto(m.body_text.match(/http\S+/)![0]);
    await pw.getByLabel("Nouveau mot de passe").fill("nouveau-mot-de-passe-9");
    await pw.getByLabel("Confirmez le mot de passe").fill("nouveau-mot-de-passe-9");
    await pw.getByRole("button", { name: "Changer le mot de passe" }).click();
    await pw.waitForURL("**/login?reset=1");
    await login(pw, email, "nouveau-mot-de-passe-9");
    await pw.goto("/account");
    await pw.getByRole("button", { name: "Délier mon compte Google" }).click();
    await expect(pw.getByText("Votre compte Google est délié")).toBeVisible();
    // Google ne reconnaît plus ce compte : et il ne peut pas non plus s'emparer de l'adresse (compte local vérifié existant)
    const g2 = await (await newContext(browser)).newPage();
    await control("options", { loginEmail: email });
    await googleLogin(g2);
    await expect(g2.getByText(/Un compte existe déjà/)).toBeVisible();
  });

  test("GS-E9 lier un compte Google déjà utilisé par un autre utilisateur : refusé", async ({ page, browser }) => {
    const shared = uniq();
    await newGoogleUser(page, { email: shared });
    const h = await makeHost();
    const p2 = await (await newContext(browser)).newPage();
    await login(p2, h.email);
    await control("options", { loginEmail: shared });
    await p2.goto("/account");
    await p2.getByRole("button", { name: "Lier mon compte Google" }).click();
    await expect(p2.getByText("Ce compte Google est déjà lié à un autre compte")).toBeVisible();
  });

  test("GS-E10 suppression d'un compte Google seul : adresse exacte exigée, session récente exigée", async ({ page }) => {
    const email = await newGoogleUser(page);
    await page.goto("/account");
    await expect(page.getByLabel(/Tapez votre adresse e-mail/)).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toHaveCount(0);
    await page.getByLabel(/Tapez votre adresse e-mail/).fill("autre@gmail.test");
    await page.getByLabel(/Je comprends/).check();
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page.getByText("Cette adresse ne correspond pas")).toBeVisible();
    // session trop ancienne
    await sql("update sessions set created_at = now() - interval '20 minutes' where user_id = (select id from users where lower(email) = $1)", [email]);
    await page.goto("/account");
    await expect(page.getByText(/Votre session date de plus de 15 minutes/).first()).toBeVisible();
    await page.getByLabel(/Tapez votre adresse e-mail/).fill(email);
    await page.getByLabel(/Je comprends/).check();
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page.getByText(/reconnectez-vous d'abord/)).toBeVisible();
    expect(await sql("select 1 from users where lower(email) = $1", [email])).toHaveLength(1);
    // session récente
    await page.getByRole("button", { name: "Se déconnecter", exact: true }).click();
    await page.waitForURL("**/login");
    await googleLogin(page);
    await page.waitForURL("**/event-types");
    await page.goto("/account");
    await page.getByLabel(/Tapez votre adresse e-mail/).fill(email.toUpperCase());
    await page.getByLabel(/Je comprends/).check();
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await page.waitForURL("**/signup?deleted=1");
    expect(await sql("select 1 from users where lower(email) = $1", [email])).toHaveLength(0);
    expect(await sql("select 1 from user_identities where email = $1", [email])).toHaveLength(0);
  });

  test("GS-E11 la connexion ne demande que l'identité : aucune connexion d'agenda n'est créée ; l'agenda reste un consentement séparé", async ({ page }) => {
    const email = await newGoogleUser(page);
    expect(await sql("select 1 from calendar_connections where user_id = (select id from users where lower(email) = $1)", [email])).toHaveLength(0);
    await page.goto("/integrations");
    await expect(page.getByRole("button", { name: "Connecter Google Agenda" })).toBeVisible();
    await page.getByRole("button", { name: "Connecter Google Agenda" }).click();
    await expect(page.getByText("Google Agenda est connecté.")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test("GS-E12 limite de débit : au-delà de 20 démarrages par heure, message clair", async ({ page }) => {
    await control("options", { consent: "deny" });
    let limited = false;
    for (let i = 0; i < 23 && !limited; i++) {
      await page.goto("/login");
      await page.getByRole("button", { name: "Continuer avec Google" }).click();
      await expect(page.getByText(/Vous avez refusé l'accès|Trop de tentatives/)).toBeVisible();
      limited = await page.getByText("Trop de tentatives").isVisible();
    }
    expect(limited, "la limite doit se déclencher avant la 23e tentative").toBe(true);
  });

  test("GS-E13 nom Google hostile, très long ou avec caractères de contrôle : nettoyé, jamais interprété", async ({ page }) => {
    await newGoogleUser(page, { name: `<img src=x onerror="window.__pwn=1"> ${"x".repeat(150)}`, username: `h${randomUUID().slice(0, 8)}` });
    const row = (await sql<{ display_name: string; username: string }>("select display_name, username from profiles order by created_at desc limit 1"))[0];
    expect(row.display_name.length).toBeLessThanOrEqual(80);
    await page.goto(`/${row.username}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)).toBeUndefined();
  });

  test("GS-E14 deux onglets terminent la même inscription : un seul compte", async ({ page, context }) => {
    const email = uniq();
    await control("options", { loginEmail: email });
    await googleLogin(page);
    await page.waitForURL("**/signup/google");
    const second = await context.newPage();
    await second.goto("/signup/google");
    await page.getByLabel(/Nom dans votre lien/).fill(`a${randomUUID().slice(0, 8)}`);
    await second.getByLabel(/Nom dans votre lien/).fill(`b${randomUUID().slice(0, 8)}`);
    await Promise.all([page.getByRole("button", { name: "Créer mon compte" }).click(), second.getByRole("button", { name: "Créer mon compte" }).click()]);
    await expect.poll(async () => (await sql("select 1 from users where lower(email) = $1", [email])).length).toBe(1);
    expect(await sql("select 1 from user_identities where email = $1", [email])).toHaveLength(1);
  });

  test("GS-K parcours au clavier seul : connexion Google puis profil", async ({ page }) => {
    await control("options", { loginEmail: uniq() });
    await page.goto("/login");
    await page.getByRole("button", { name: "Continuer avec Google" }).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/signup/google");
    await page.getByRole("button", { name: "Créer mon compte" }).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/event-types");
  });

  test("GS-A accessibilité et mobile : connexion, inscription, fin d'inscription, compte lié et sans mot de passe, messages d'erreur", async ({ page, browser }) => {
    for (const p of ["/login", "/signup", "/login?error=google_exists", "/login?error=google_denied", "/signup?error=google_expired"]) {
      await page.goto(p);
      await expect(page.getByRole("button", { name: /avec Google/ })).toBeVisible();
      await expectAccessible(page);
    }
    const small = await (await newContext(browser, { width: 390, height: 800 })).newPage();
    await control("options", { loginEmail: `${randomUUID().slice(0, 8)}${"a".repeat(52)}@${"b".repeat(60)}.example`, loginName: "N".repeat(150) }); // adresse unique : le test est rejouable
    await googleLogin(small);
    await small.waitForURL("**/signup/google");
    expect(await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "débordement (fin d'inscription)").toBe(true);
    await expectAccessible(small);
    await small.getByRole("button", { name: "Créer mon compte" }).click();
    await small.waitForURL("**/event-types");
    await small.goto("/account");
    expect(await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "débordement (compte)").toBe(true);
    await expectAccessible(small);
  });

  test("GS-E15 paramètres d'erreur hostiles sur la connexion : aucun message vide ni injecté", async ({ page }) => {
    for (const q of ["__proto__", "constructor", "%3Cscript%3Ewindow.__x%3D1%3C%2Fscript%3E", "inconnu"]) {
      await page.goto(`/login?error=${q}`);
      await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
      expect(await page.locator("p[role=alert], p[role=status]").count(), `message parasite pour error=${q}`).toBe(0);
      expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
    }
  });
});
