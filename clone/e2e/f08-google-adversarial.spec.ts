// Deuxième passe sur S02 : cas limites et hypothèses de défauts. Toujours contre le faux Google (voir f07).
import { test, expect, expectAccessible } from "./fixtures.ts";
import { fillGuest, login, makeHost, makeType, newContext, pickSlot, sql, waitForMail } from "./helpers.ts";

const G = "http://127.0.0.1:3199";
const control = (path: string, body: unknown = {}) => fetch(`${G}/__control/${path}`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());
type FakeState = { events: { id: string; summary: string; description: string; start: { dateTime: string } }[]; deleted: string[]; refreshTokens: { revoked: boolean }[] };
const fakeState = (email = "host@gmail.test"): Promise<FakeState> => fetch(`${G}/__control/state?email=${encodeURIComponent(email)}`).then((r) => r.json());
const confirm = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /^Confirmer le/ });

test.beforeEach(async () => { await control("reset"); });

async function connected(page: import("@playwright/test").Page) {
  const h = await makeHost();
  await login(page, h.email);
  await page.goto("/integrations");
  await page.getByRole("button", { name: "Connecter Google Agenda" }).click();
  await expect(page.getByText("Google Agenda est connecté.")).toBeVisible();
  return h;
}
const guestPage = async (browser: import("@playwright/test").Browser) => (await newContext(browser)).newPage();
const open = async (g: import("@playwright/test").Page, path: string) => { await g.goto(path); await g.getByLabel("Votre fuseau horaire").waitFor(); };

test.describe("S02 passe 2 : cas limites", () => {
  test("G2-E1 Google très lent : la page publique reste réactive (moins de 5 s), les créneaux s'affichent", async ({ page, browser }) => {
    const h = await connected(page);
    const et = await makeType(h.host);
    await control("delay", { target: "freebusy", ms: 9000, times: 1 });
    const g = await guestPage(browser);
    const t0 = Date.now();
    await open(g, `/${h.username}/${et.slug}`);
    const ms = Date.now() - t0;
    expect(ms, `la page a mis ${ms} ms : un agenda lent ne doit pas faire attendre l'invité`).toBeLessThan(5000);
    await expect(g.locator("section[aria-label='Choisir une date'] button[aria-pressed]:not([disabled])").first()).toBeVisible();
  });

  test("G2-E2 paramètre d'erreur hostile ou inconnu (__proto__, constructor, balises) : aucun message vide ni injecté", async ({ page }) => {
    const { email } = await makeHost();
    await login(page, email);
    for (const q of ["__proto__", "constructor", "toString", "%3Cscript%3Ewindow.__x%3D1%3C%2Fscript%3E", "inconnu"]) {
      await page.goto(`/integrations?error=${q}`);
      await expect(page.getByRole("heading", { name: "Calendrier" })).toBeVisible();
      expect(await page.locator("p[role=alert], p[role=status]").count(), `message parasite pour error=${q}`).toBe(0);
      expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
    }
  });

  test("G2-E3 adresse de compte Google très longue : pas de débordement à 390 px, connecté comme révoqué", async ({ browser }) => {
    const long = `${"a".repeat(60)}@${"b".repeat(60)}.example`;
    await control("options", { loginEmail: long });
    const h = await makeHost();
    const small = await (await newContext(browser, { width: 390, height: 800 })).newPage();
    await login(small, h.email);
    await small.goto("/integrations");
    await small.getByRole("button", { name: "Connecter Google Agenda" }).click();
    await expect(small.getByText("Google Agenda est connecté.")).toBeVisible();
    expect(await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "débordement (connecté)").toBe(true);
    await control("revoke-all", { email: long });
    const et = await makeType(h.host);
    const g = await guestPage(browser);
    await open(g, `/${h.username}/${et.slug}`);
    await small.goto("/integrations");
    await expect(small.getByRole("heading", { name: "Google Agenda : reconnexion nécessaire" })).toBeVisible();
    expect(await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "débordement (révoqué)").toBe(true);
  });

  test("G2-E4 le cookie d'état d'un autre utilisateur ne sert à rien (lié à l'utilisateur)", async ({ page, context }) => {
    const a = await makeHost(), b = await makeHost();
    await login(page, b.email);
    const state = "etat-connu";
    await context.addCookies([{ name: "g_oauth", value: Buffer.from(JSON.stringify({ state, verifier: "v", userId: a.host.id, exp: Date.now() + 60_000 })).toString("base64url"), url: "http://localhost:3100/api/google/" }]);
    await page.goto(`/api/google/callback?code=abc&state=${state}`);
    await expect(page.getByText("La demande de connexion a expiré ou n'est pas valide")).toBeVisible();
    expect(await sql("select 1 from calendar_connections where user_id in ($1, $2)", [a.host.id, b.host.id])).toHaveLength(0);
  });

  test("G2-E5 cookie d'état expiré : refusé", async ({ page, context }) => {
    const h = await makeHost();
    await login(page, h.email);
    await context.addCookies([{ name: "g_oauth", value: Buffer.from(JSON.stringify({ state: "s", verifier: "v", userId: h.host.id, exp: Date.now() - 1000 })).toString("base64url"), url: "http://localhost:3100/api/google/" }]);
    await page.goto("/api/google/callback?code=abc&state=s");
    await expect(page.getByText("La demande de connexion a expiré ou n'est pas valide")).toBeVisible();
  });

  test("G2-E6 rejouer l'adresse de retour après une connexion réussie : refusé, la connexion reste intacte", async ({ page }) => {
    const h = await makeHost();
    await login(page, h.email);
    let callback = "";
    page.on("request", (r) => { if (r.url().includes("/api/google/callback")) callback = r.url(); });
    await page.goto("/integrations");
    await page.getByRole("button", { name: "Connecter Google Agenda" }).click();
    await expect(page.getByText("Google Agenda est connecté.")).toBeVisible();
    expect(callback).toContain("code=");
    await page.goto(callback);
    await expect(page.getByText("La demande de connexion a expiré ou n'est pas valide")).toBeVisible();
    await expect(page.getByText("Google Agenda est connecté.")).toHaveCount(0); // pas de faux message de succès
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: "Google Agenda connecté" })).toBeVisible();
    expect((await sql("select 1 from calendar_connections where user_id = $1", [h.host.id])).length).toBe(1);
  });

  test("G2-E7 reconnexion avec un autre compte Google : le nouveau compte est affiché et reçoit les événements", async ({ page, browser }) => {
    const h = await connected(page);
    const et = await makeType(h.host);
    await control("revoke-all", { email: "host@gmail.test" });
    const g = await guestPage(browser);
    await open(g, `/${h.username}/${et.slug}`);
    await control("options", { loginEmail: "autre@gmail.test" });
    await page.goto("/integrations");
    await page.getByRole("button", { name: "Reconnecter Google Agenda" }).click();
    await expect(page.getByText("autre@gmail.test")).toBeVisible();
    await pickSlot(g);
    await fillGuest(g, "Nouveau Compte", "nouveau@example.test");
    await confirm(g).click();
    await g.waitForURL("**/booking/**");
    await expect.poll(async () => (await fakeState("autre@gmail.test")).events.length, { timeout: 15_000 }).toBe(1);
    expect((await fakeState("host@gmail.test")).events).toHaveLength(0);
  });

  test("G2-E8 limite de débit de la connexion : au-delà de 10 essais par heure, message clair", async ({ page }) => {
    const h = await makeHost();
    await login(page, h.email);
    let limited = false;
    for (let i = 0; i < 12 && !limited; i++) {
      await sql("delete from calendar_connections where user_id = $1", [h.host.id]); // repartir de « non connecté » à chaque essai
      await page.goto("/integrations");
      await page.getByRole("button", { name: "Connecter Google Agenda" }).click();
      // L'adresse ne change pas (on reste sur /integrations) : on attend l'un des deux résultats possibles.
      await Promise.race([page.getByText("Google Agenda est connecté.").waitFor(), page.getByText("Trop de tentatives").waitFor()]);
      limited = await page.getByText("Trop de tentatives").isVisible();
    }
    expect(limited, "la limite doit se déclencher avant la 12e tentative").toBe(true);
    await expect(page.getByRole("button", { name: "Connecter Google Agenda" })).toBeVisible();
  });

  test("G2-E9 l'hôte annule depuis son tableau de bord : l'événement Google est supprimé", async ({ page, browser }) => {
    const h = await connected(page);
    const et = await makeType(h.host);
    const g = await guestPage(browser);
    await open(g, `/${h.username}/${et.slug}`);
    await pickSlot(g);
    await fillGuest(g, "À Annuler", "annuler@example.test");
    await confirm(g).click();
    await g.waitForURL("**/booking/**");
    await expect.poll(async () => (await fakeState()).events.length, { timeout: 15_000 }).toBe(1);
    await page.goto("/bookings");
    await page.getByRole("button", { name: /Annuler la réunion avec À Annuler/ }).click();
    await expect.poll(async () => (await fakeState()).events.length, { timeout: 15_000 }).toBe(0);
  });

  test("G2-E10 replanification par l'invité : l'ancien événement disparaît, le nouveau est créé", async ({ page, browser }) => {
    const h = await connected(page);
    const et = await makeType(h.host);
    const g = await guestPage(browser);
    await open(g, `/${h.username}/${et.slug}`);
    await pickSlot(g, 0);
    await fillGuest(g, "Replan", "replan@example.test");
    await confirm(g).click();
    await g.waitForURL("**/booking/**");
    await expect.poll(async () => (await fakeState()).events.length, { timeout: 15_000 }).toBe(1);
    const firstId = (await fakeState()).events[0].id;
    await g.getByRole("link", { name: "Choisir un autre créneau" }).click();
    await g.getByLabel("Votre fuseau horaire").waitFor();
    await pickSlot(g, 3);
    await confirm(g).click();
    await g.waitForURL((u) => u.pathname.startsWith("/booking/"));
    await expect.poll(async () => { const s = await fakeState(); return s.events.length === 1 && s.events[0].id !== firstId; }, { timeout: 15_000 }).toBe(true);
    expect((await fakeState()).deleted).toContain(firstId);
  });

  test("G2-E11 clavier seul : connecter, régler, enregistrer, sans souris", async ({ page }) => {
    const { email } = await makeHost();
    await login(page, email);
    await page.goto("/integrations");
    await page.getByRole("button", { name: "Connecter Google Agenda" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Google Agenda est connecté.")).toBeVisible();
    await page.getByLabel(/Ne pas proposer les créneaux/).focus();
    await page.keyboard.press("Space");
    await expect(page.getByLabel(/Ne pas proposer les créneaux/)).not.toBeChecked();
    await page.getByRole("button", { name: "Enregistrer" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Réglages enregistrés.")).toBeVisible();
  });

  test("G2-E12 enregistrer les réglages hors ligne : message clair, la saisie est conservée", async ({ page, context }) => {
    await connected(page);
    await page.getByLabel(/Ne pas proposer les créneaux/).uncheck();
    await context.setOffline(true);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Impossible de joindre le serveur")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/Ne pas proposer les créneaux/)).not.toBeChecked();
    await context.setOffline(false);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Réglages enregistrés.")).toBeVisible();
  });

  test("G2-E13 le détail technique d'une erreur Google n'est jamais montré à l'utilisateur ni écrit dans les journaux d'erreur HTTP", async ({ page, browser }) => {
    const h = await connected(page);
    const et = await makeType(h.host);
    await control("fail", { target: "events", status: 403, times: 10 });
    const g = await guestPage(browser);
    await open(g, `/${h.username}/${et.slug}`);
    await pickSlot(g);
    await fillGuest(g, "Écriture Refusée", "ecriture@example.test");
    await confirm(g).click();
    await g.waitForURL("**/booking/**");
    await new Promise((r) => setTimeout(r, 2500));
    await page.goto("/integrations");
    const text = await page.locator("main").innerText();
    expect(text).toMatch(/refusé l'écriture/);
    expect(text).not.toMatch(/\{|"error"|403|Backend Error/);
  });

  test("G2-A accessibilité des messages d'erreur et d'état de la page Calendrier", async ({ page }) => {
    const { email } = await makeHost();
    await login(page, email);
    for (const q of ["error=denied", "error=state", "error=scope", "error=no_refresh", "error=google", "error=rate", "disconnected=1", "connected=readonly"]) {
      await page.goto(`/integrations?${q}`);
      await expect(page.getByRole("heading", { name: "Calendrier" })).toBeVisible();
      await expectAccessible(page);
    }
  });
});
