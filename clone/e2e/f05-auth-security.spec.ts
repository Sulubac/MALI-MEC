// Transverse : comptes, sessions, sécurité
import { test, expect, expectAccessible } from "./fixtures.ts";
import { bookDirect, login, makeHost, makeType, newContext, PASSWORD, sql, waitForMail } from "./helpers.ts";

const link = (body: string, path: string) => body.match(new RegExp(`http://localhost:3100${path}\\S*`))![0];

test.describe("Comptes et sécurité", () => {
  test("A-H1 lien de confirmation : à usage unique, un nouveau lien invalide l'ancien, le simple chargement ne le consomme pas", async ({ page }) => {
    const u = `v${Date.now().toString(36)}`;
    const email = `${u}@example.test`;
    await page.goto("/signup");
    await page.getByLabel("Votre nom").fill("Vérif");
    await page.getByLabel(/Nom dans votre lien/).fill(u);
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    const [m1] = await waitForMail("to_address = $1", [email]);
    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("pas encore confirmée")).toBeVisible();
    await page.getByRole("button", { name: "Renvoyer le lien de confirmation" }).click();
    const mails = await waitForMail("to_address = $1", [email], 2);
    expect(mails).toHaveLength(2);
    await page.goto(link(m1.body_text, "/verify"));
    await expect(page.getByText("invalide ou a expiré").first()).toBeVisible();
    await page.goto(link(mails[1].body_text, "/verify"));
    expect(await sql("select 1 from users where email = $1 and email_verified_at is not null", [email])).toHaveLength(0);
    await page.getByRole("button", { name: "Confirmer mon adresse" }).click();
    await page.waitForURL("**/login?verified=1");
    expect(await sql("select 1 from users where email = $1 and email_verified_at is not null", [email])).toHaveLength(1);
  });

  test("A-H2 mot de passe oublié : même réponse pour une adresse inconnue, lien unique, sessions coupées", async ({ page, browser }) => {
    const { email } = await makeHost();
    const other = await (await newContext(browser)).newPage();
    await login(other, email);
    await page.goto("/forgot");
    await page.getByLabel("Adresse e-mail").fill("inconnu@example.test");
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(page.getByText("Si un compte correspond")).toBeVisible();
    expect(await sql("select 1 from email_outbox where to_address = 'inconnu@example.test'")).toHaveLength(0);
    await page.goto("/forgot");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(page.getByText("Si un compte correspond")).toBeVisible();
    const [m] = await waitForMail("to_address = $1 and subject like 'Choisissez%'", [email]);
    const url = link(m.body_text, "/reset");
    await page.goto(url);
    await page.getByLabel("Nouveau mot de passe").fill("nouveau-mot-de-passe-9");
    await page.getByLabel("Confirmez le mot de passe").fill("nouveau-mot-de-passe-9");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await page.waitForURL("**/login?reset=1");
    await page.goto(url);
    await expect(page.getByText("invalide ou a expiré").first()).toBeVisible();
    await other.goto("/event-types");
    await expect(other).toHaveURL(/\/login$/);
    await login(page, email, "nouveau-mot-de-passe-9");
  });

  test("A-E1 e-mail saisi avec majuscules et espaces : la connexion fonctionne", async ({ page }) => {
    const { email } = await makeHost();
    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(`  ${email.toUpperCase()}  `);
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL("**/event-types");
  });

  test("A-E2 limite de débit : la connexion est bloquée après 8 essais pour une adresse, le message est clair", async ({ page }) => {
    await page.goto("/login");
    const target = `cible${Date.now().toString(36)}@example.test`;
    let blocked = false;
    for (let i = 0; i < 10 && !blocked; i++) {
      await page.getByLabel("Adresse e-mail").fill(target);
      await page.getByLabel("Mot de passe").fill(`essai-${i}-xxxxxxxx`);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await expect(page.getByText(/Adresse ou mot de passe incorrect|Trop de tentatives/)).toBeVisible();
      blocked = await page.getByText("Trop de tentatives").isVisible();
    }
    expect(blocked).toBe(true);
  });

  test("A-E3 inscription avec une adresse déjà inscrite : même écran, un seul compte, courrier explicatif", async ({ page }) => {
    const { email } = await makeHost();
    await page.goto("/signup");
    await page.getByLabel("Votre nom").fill("Intrus");
    await page.getByLabel(/Nom dans votre lien/).fill(`intrus${Date.now().toString(36)}`);
    await page.getByLabel("Adresse e-mail").fill(email.toUpperCase());
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByRole("heading", { name: "Vérifiez votre boîte e-mail" })).toBeVisible();
    expect(await sql("select 1 from users where lower(email) = lower($1)", [email])).toHaveLength(1);
    const [m] = await waitForMail("to_address = $1 and subject like 'Un compte existe déjà%'", [email]);
    expect(m).toBeTruthy();
  });

  test("A-E4 cookie de session : HttpOnly, Secure, SameSite=Lax, préfixe __Host- ; absent du JavaScript", async ({ page, context }) => {
    const { email } = await makeHost();
    await login(page, email);
    const c = (await context.cookies()).find((x) => /sid/.test(x.name))!;
    expect(c).toMatchObject({ name: "__Host-sid", httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    expect(await page.evaluate(() => document.cookie)).not.toContain("sid");
    expect(await sql("select 1 from sessions where token_hash = $1", [c.value])).toHaveLength(0); // jamais stocké en clair
  });

  test("A-E5 « se déconnecter partout » ferme les autres appareils ; la déconnexion simple n'en ferme qu'un", async ({ browser }) => {
    const { email } = await makeHost();
    const a = await (await newContext(browser)).newPage(), b = await (await newContext(browser)).newPage(), c = await (await newContext(browser)).newPage();
    await login(a, email); await login(b, email); await login(c, email);
    await a.getByRole("button", { name: "Se déconnecter" }).click();
    await a.waitForURL("**/login");
    await b.goto("/event-types");
    await expect(b).toHaveURL(/\/event-types$/);
    await b.goto("/account");
    await b.getByRole("button", { name: "Se déconnecter partout" }).click();
    await b.waitForURL("**/login");
    await c.goto("/event-types");
    await expect(c).toHaveURL(/\/login$/);
  });

  test("A-E6 suppression de compte : mot de passe exigé, tout est effacé, liens publics en 404", async ({ page, browser }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host);
    const booking = await bookDirect(host, et);
    await login(page, email);
    await page.goto("/account");
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
    await page.getByLabel(/Je comprends/).check();
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page.getByText("Mot de passe incorrect.")).toBeVisible();
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await page.waitForURL("**/signup?deleted=1");
    expect(await sql("select 1 from users where id = $1", [host.id])).toHaveLength(0);
    expect(await sql("select 1 from bookings where host_id = $1", [host.id])).toHaveLength(0);
    expect(await sql("select 1 from event_types where owner_id = $1", [host.id])).toHaveLength(0);
    const g = await (await newContext(browser)).newPage();
    expect((await g.goto(`/${username}`))!.status()).toBe(404);
    expect((await g.goto(`/booking/${booking.manageToken}`))!.status()).toBe(404);
  });

  test("A-E7 la suppression de compte exige la case de confirmation", async ({ page }) => {
    const { email, host } = await makeHost();
    await login(page, email);
    await page.goto("/account");
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page.getByText("Cochez la case pour confirmer.")).toBeVisible();
    expect(await sql("select 1 from users where id = $1", [host.id])).toHaveLength(1);
  });

  test("A-E8 en-têtes de sécurité sur les pages", async ({ request }) => {
    const r = await request.get("/login");
    const h = r.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("A-E9 point d'entrée de la file de tâches : refusé sans secret ou avec un mauvais secret", async ({ request }) => {
    expect((await request.get("/api/cron/jobs")).status()).toBe(401);
    expect((await request.get("/api/cron/jobs", { headers: { authorization: "Bearer faux" } })).status()).toBe(401);
    expect((await request.get("/api/cron/jobs", { headers: { authorization: "Basic abc" } })).status()).toBe(401);
    const ok = await request.get("/api/cron/jobs", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(ok.status()).toBe(200);
  });

  test("A-E10 pages protégées sans session : redirection vers la connexion", async ({ page }) => {
    for (const p of ["/event-types", "/event-types/new", "/availability", "/bookings", "/account"]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/login$/);
    }
  });

  test("A-E11 jetons de vérification et de réinitialisation falsifiés : message d'erreur, jamais de 500", async ({ page }) => {
    for (const p of ["/verify", "/verify?token=", "/verify?token=abc", "/reset", "/reset?token=%00", `/reset?token=${"a".repeat(5000)}`]) {
      const r = await page.goto(p);
      expect(r!.status(), p).toBeLessThan(500);
    }
  });

  test("A-E12 une session est refusée si le compte n'est plus vérifié ou si la ligne a expiré", async ({ page }) => {
    const { email, host } = await makeHost();
    await login(page, email);
    await sql("update sessions set expires_at = now() - interval '1 second' where user_id = $1", [host.id]);
    await page.goto("/event-types");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("A-A accessibilité des écrans d'authentification", async ({ page }) => {
    for (const p of ["/login", "/signup", "/forgot"]) {
      await page.goto(p);
      await expect(page.locator("main")).toBeVisible();
      await expectAccessible(page);
    }
    await page.goto("/verify?token=abc");
    await expectAccessible(page);
    await page.goto("/reset?token=abc");
    await expectAccessible(page);
  });

  test("A-T chaque écran a un titre propre (onglets distincts, titre descriptif)", async ({ page }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host, { name: "Titre test" });
    const titles = new Map<string, string>();
    const visit = async (path: string) => { await page.goto(path); titles.set(path, await page.title()); };
    for (const p of ["/login", "/signup", "/forgot", `/${username}`, `/${username}/${et.slug}`]) await visit(p);
    await login(page, email);
    for (const p of ["/event-types", "/event-types/new", `/event-types/${et.id}/edit`, "/availability", "/bookings", "/account"]) await visit(p);
    for (const [path, title] of titles) expect(title, `titre de ${path}`).not.toBe("Planifier");
    expect(new Set(titles.values()).size, "tous les titres sont différents").toBe(titles.size);
    expect(titles.get(`/${username}/${et.slug}`)).toContain("Titre test");
  });

  test("A-O connexion hors ligne : message clair, pas d'écran d'erreur, réessayer fonctionne", async ({ page, context }) => {
    const { email } = await makeHost();
    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await context.setOffline(true);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Impossible de joindre le serveur")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel("Adresse e-mail")).toHaveValue(email);
    await context.setOffline(false);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL("**/event-types");
  });
});
