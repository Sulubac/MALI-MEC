// S02 : connexion de l'agenda Google. L'application parle au faux Google (e2e/fake-google.ts) : ces tests vérifient NOTRE code,
// pas le comportement du vrai Google, qui reste à valider avec de vrais identifiants.
import { test, expect, expectAccessible } from "./fixtures.ts";
import { fillGuest, login, makeHost, makeType, newContext, pickSlot, sql, waitForMail } from "./helpers.ts";

const G = "http://127.0.0.1:3199";
const control = (path: string, body: unknown = {}) => fetch(`${G}/__control/${path}`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());
type FakeState = { events: { id: string; summary: string; description: string }[]; deleted: string[]; refreshTokens: { revoked: boolean }[] };
const fakeState = (email = "host@gmail.test"): Promise<FakeState> => fetch(`${G}/__control/state?email=${encodeURIComponent(email)}`).then((r) => r.json());
const hhmm = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
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

test.describe("S02 agenda Google", () => {
  test("G-H1 connexion complète : état et PKCE en cookie HttpOnly, retour sur la page, compte affiché, réglages par défaut", async ({ page, context }) => {
    const { email } = await makeHost();
    await login(page, email);
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: "Calendrier" })).toBeVisible();
    let authCookie: { httpOnly: boolean; sameSite: string; path: string } | undefined;
    let authUrl: URL | undefined;
    await page.route(`${G}/auth*`, async (route) => {
      authUrl = new URL(route.request().url());
      authCookie = (await context.cookies()).find((c) => c.name === "g_oauth");
      await route.continue();
    });
    await page.getByRole("button", { name: "Connecter Google Agenda" }).click();
    await expect(page.getByText("Google Agenda est connecté.")).toBeVisible();
    expect(authCookie, "cookie d'état posé avant la redirection").toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/api/google" });
    expect(authUrl!.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authUrl!.searchParams.get("scope")).toContain("calendar.freebusy");
    expect((await context.cookies()).find((c) => c.name === "g_oauth"), "cookie supprimé après le retour").toBeUndefined();
    await expect(page.getByText("host@gmail.test")).toBeVisible();
    await expect(page.getByLabel(/Ne pas proposer les créneaux/)).toBeChecked();
    await expect(page.getByLabel(/Ajouter les rendez-vous réservés/)).toBeChecked();
    const row = (await sql<{ refresh_token_enc: string }>("select refresh_token_enc from calendar_connections"))[0];
    expect(row.refresh_token_enc.startsWith("v1.")).toBe(true);
  });

  test("G-H2 un événement Google retire le créneau chez l'invité", async ({ page, browser }) => {
    const h = await connected(page);
    const et = await makeType(h.host);
    const { listSlots } = await import("../lib/store.ts");
    const target = (await listSlots(h.host, et)).find((s) => Date.parse(s) > Date.now() + 3 * 24 * 3600_000)!;
    const guest = await (await newContext(browser)).newPage();
    await guest.goto(`/${h.username}/${et.slug}`);
    await guest.getByLabel("Votre fuseau horaire").waitFor();
    const dayIndex = async () => guest.locator("section[aria-label='Choisir une date'] button[aria-pressed]:not([disabled])").evaluateAll((els, d) => els.findIndex((e) => (e.getAttribute("aria-label") ?? "").includes(d)), new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" }).format(new Date(target)));
    const times = async () => {
      await guest.locator("section[aria-label='Choisir une date'] button[aria-pressed]:not([disabled])").nth(await dayIndex()).click();
      return guest.locator("section[aria-label^='Créneaux'] ul button").allTextContents();
    };
    expect(await times()).toContain(hhmm(target));
    await control("busy", { email: "host@gmail.test", start: target, end: new Date(Date.parse(target) + 30 * 60_000).toISOString() });
    await guest.reload();
    await guest.getByLabel("Votre fuseau horaire").waitFor();
    expect(await times()).not.toContain(hhmm(target));
  });

  test("G-H3 réservation : événement créé dans Google (titre, description) ; annulation : événement supprimé", async ({ page, browser }) => {
    const h = await connected(page);
    const et = await makeType(h.host, { name: "Atelier" });
    const guest = await (await newContext(browser)).newPage();
    await guest.goto(`/${h.username}/${et.slug}`);
    await guest.getByLabel("Votre fuseau horaire").waitFor();
    await pickSlot(guest);
    await fillGuest(guest, "Camille Durand", "camille@example.test");
    await confirm(guest).click();
    await guest.waitForURL("**/booking/**");
    await expect.poll(async () => (await fakeState()).events.length, { timeout: 15_000 }).toBe(1);
    const ev = (await fakeState()).events[0];
    expect(ev.summary).toBe("Atelier : Camille Durand");
    expect(ev.description).toContain("camille@example.test");
    await guest.getByRole("button", { name: "Annuler la réservation" }).click();
    await expect(guest.getByText("Cette réservation est annulée")).toBeVisible();
    await expect.poll(async () => (await fakeState()).events.length, { timeout: 15_000 }).toBe(0);
    expect((await fakeState()).deleted).toContain(ev.id);
  });

  test("G-E1 événement ajouté pendant que l'invité remplit le formulaire : message clair, créneau retiré, aucune réservation", async ({ page, browser }) => {
    const h = await connected(page);
    const et = await makeType(h.host);
    const guest = await (await newContext(browser)).newPage();
    await guest.goto(`/${h.username}/${et.slug}`);
    await guest.getByLabel("Votre fuseau horaire").waitFor();
    await pickSlot(guest);
    const takenLabel = (await guest.getByRole("button", { name: /^Confirmer le/ }).textContent())!;
    const { listSlots } = await import("../lib/store.ts");
    const first = (await listSlots(h.host, et))[0];
    await control("busy", { email: "host@gmail.test", start: first, end: new Date(Date.parse(first) + 30 * 60_000).toISOString() });
    await fillGuest(guest, "Trop Tard", "tard@example.test");
    await confirm(guest).click();
    await expect(guest.getByRole("alert").filter({ hasText: /vient d'être pris|n'est plus proposé/ })).toBeVisible();
    expect(takenLabel).toContain(hhmm(first));
    expect(await sql("select 1 from bookings where host_id = $1", [h.host.id])).toHaveLength(0);
  });

  test("G-E2 Google injoignable au moment de confirmer : message, sélection conservée, réessayer fonctionne", async ({ page, browser }) => {
    const h = await connected(page);
    const et = await makeType(h.host);
    const guest = await (await newContext(browser)).newPage();
    await guest.goto(`/${h.username}/${et.slug}`);
    await guest.getByLabel("Votre fuseau horaire").waitFor();
    await pickSlot(guest);
    await fillGuest(guest, "Patient", "patient@example.test");
    await control("fail", { target: "freebusy", status: 503, times: 1 });
    await confirm(guest).click();
    await expect(guest.getByRole("alert").filter({ hasText: "Impossible de vérifier l'agenda" })).toBeVisible();
    await expect(confirm(guest)).toBeEnabled();
    expect(await sql("select 1 from bookings where host_id = $1", [h.host.id])).toHaveLength(0);
    await confirm(guest).click();
    await guest.waitForURL("**/booking/**");
  });

  test("G-E3 consentement refusé : message clair, rien n'est connecté", async ({ page }) => {
    const { email, host } = await makeHost();
    await login(page, email);
    await control("options", { consent: "deny" });
    await page.goto("/integrations");
    await page.getByRole("button", { name: "Connecter Google Agenda" }).click();
    await expect(page.getByText("Vous avez refusé l'accès")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connecter Google Agenda" })).toBeVisible();
    expect(await sql("select 1 from calendar_connections where user_id = $1", [host.id])).toHaveLength(0);
  });

  test("G-E4 consentement partiel : lecture seule, option d'écriture désactivée et expliquée", async ({ page }) => {
    const { email } = await makeHost();
    await login(page, email);
    await control("options", { deniedScopes: ["https://www.googleapis.com/auth/calendar.events"] });
    await page.goto("/integrations");
    await page.getByRole("button", { name: "Connecter Google Agenda" }).click();
    await expect(page.getByText("connecté en lecture seule")).toBeVisible();
    await expect(page.getByLabel(/Ajouter les rendez-vous réservés/)).toBeDisabled();
    await expect(page.getByText(/Vous n'avez pas autorisé l'ajout d'événements/).first()).toBeVisible();
  });

  test("G-E5 aucune autorisation de lecture accordée : refus explicite", async ({ page }) => {
    const { email, host } = await makeHost();
    await login(page, email);
    await control("options", { deniedScopes: ["https://www.googleapis.com/auth/calendar.freebusy", "https://www.googleapis.com/auth/calendar.events"] });
    await page.goto("/integrations");
    await page.getByRole("button", { name: "Connecter Google Agenda" }).click();
    await expect(page.getByText("L'accès à vos disponibilités n'a pas été accordé")).toBeVisible();
    expect(await sql("select 1 from calendar_connections where user_id = $1", [host.id])).toHaveLength(0);
  });

  test("G-E6 retour falsifié ou expiré : état invalide refusé, rien n'est enregistré", async ({ page }) => {
    const { email, host } = await makeHost();
    await login(page, email);
    await page.goto("/integrations");
    await page.route(`${G}/auth*`, (route) => route.fulfill({ status: 302, headers: { location: "http://localhost:3100/api/google/callback?code=abc&state=falsifie" } }));
    await page.getByRole("button", { name: "Connecter Google Agenda" }).click();
    await expect(page.getByText("La demande de connexion a expiré ou n'est pas valide")).toBeVisible();
    expect(await sql("select 1 from calendar_connections where user_id = $1", [host.id])).toHaveLength(0);
    // sans cookie du tout
    await page.goto("/api/google/callback?code=abc&state=xyz");
    await expect(page.getByText("La demande de connexion a expiré ou n'est pas valide")).toBeVisible();
  });

  test("G-E7 retour sans session : renvoi vers la connexion", async ({ request }) => {
    const r = await request.get("/api/google/callback?code=abc&state=xyz", { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(r.headers()["location"]).toContain("/login");
  });

  test("G-E8 pas de jeton de rafraîchissement renvoyé : message dédié", async ({ page }) => {
    const { email, host } = await makeHost();
    await login(page, email);
    await control("options", { noRefreshToken: true });
    await page.goto("/integrations");
    await page.getByRole("button", { name: "Connecter Google Agenda" }).click();
    await expect(page.getByText("Google n'a pas fourni d'autorisation durable")).toBeVisible();
    expect(await sql("select 1 from calendar_connections where user_id = $1", [host.id])).toHaveLength(0);
  });

  test("G-E9 réglages : décocher la lecture ignore l'agenda, décocher l'écriture n'ajoute plus d'événements", async ({ page, browser }) => {
    const h = await connected(page);
    const et = await makeType(h.host);
    await page.getByLabel(/Ne pas proposer les créneaux/).uncheck();
    await page.getByLabel(/Ajouter les rendez-vous réservés/).uncheck();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Réglages enregistrés.")).toBeVisible();
    const { listSlots } = await import("../lib/store.ts");
    const first = (await listSlots(h.host, et))[0];
    await control("busy", { email: "host@gmail.test", start: first, end: new Date(Date.parse(first) + 30 * 60_000).toISOString() });
    expect((await listSlots(h.host, et)).includes(first), "l'agenda est ignoré").toBe(true);
    const guest = await (await newContext(browser)).newPage();
    await guest.goto(`/${h.username}/${et.slug}`);
    await guest.getByLabel("Votre fuseau horaire").waitFor();
    await pickSlot(guest, 3);
    await fillGuest(guest, "Sans Écriture", "sans@example.test");
    await confirm(guest).click();
    await guest.waitForURL("**/booking/**");
    await new Promise((r) => setTimeout(r, 1500));
    expect((await fakeState()).events).toHaveLength(0);
    await page.reload();
    await expect(page.getByLabel(/Ne pas proposer les créneaux/)).not.toBeChecked();
  });

  test("G-E10 accès retiré chez Google : bandeau de reconnexion, e-mail, créneaux non filtrés, reconnexion possible", async ({ page, browser, request }) => {
    const h = await connected(page);
    const et = await makeType(h.host);
    await control("revoke-all", { email: "host@gmail.test" });
    const guest = await (await newContext(browser)).newPage();
    await guest.goto(`/${h.username}/${et.slug}`); // déclenche la lecture de l'agenda → détection de la révocation
    await guest.getByLabel("Votre fuseau horaire").waitFor();
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: "Google Agenda : reconnexion nécessaire" })).toBeVisible();
    await request.get("/api/cron/jobs", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    const [mail] = await waitForMail("to_address = $1 and subject like 'Reconnectez%'", [h.email]);
    expect(mail.body_text).toContain("/integrations");
    await pickSlot(guest); // la réservation reste possible
    await page.getByRole("button", { name: "Reconnecter Google Agenda" }).click();
    await expect(page.getByText("Google Agenda est connecté.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Google Agenda connecté" })).toBeVisible();
  });

  test("G-E11 déconnexion : confirmation, accès révoqué chez Google, retour à l'état initial", async ({ page }) => {
    const h = await connected(page);
    await page.getByRole("button", { name: "Déconnecter Google Agenda" }).click();
    await page.getByRole("button", { name: "Garder la connexion" }).click();
    await expect(page.getByText("host@gmail.test")).toBeVisible();
    await page.getByRole("button", { name: "Déconnecter Google Agenda" }).click();
    await page.getByRole("button", { name: "Confirmer la déconnexion" }).click();
    await expect(page.getByText("Google Agenda est déconnecté.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connecter Google Agenda" })).toBeVisible();
    expect((await fakeState()).refreshTokens.every((t) => t.revoked)).toBe(true);
    expect(await sql("select 1 from calendar_connections where user_id = $1", [h.host.id])).toHaveLength(0);
  });

  test("G-E12 cloisonnement : la connexion d'un hôte est invisible pour un autre", async ({ page, browser }) => {
    await connected(page);
    const other = await makeHost();
    const p2 = await (await newContext(browser)).newPage();
    await login(p2, other.email);
    await p2.goto("/integrations");
    await expect(p2.getByRole("button", { name: "Connecter Google Agenda" })).toBeVisible();
    await expect(p2.getByText("host@gmail.test")).toHaveCount(0);
  });

  test("G-E13 suppression du compte : l'accès Google est révoqué", async ({ page }) => {
    const h = await connected(page);
    await page.goto("/account");
    await page.getByLabel("Mot de passe").fill("un-mot-de-passe-solide-1");
    await page.getByLabel(/Je comprends/).check();
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await page.waitForURL("**/signup?deleted=1");
    expect((await fakeState()).refreshTokens.every((t) => t.revoked)).toBe(true);
    expect(await sql("select 1 from calendar_connections where user_id = $1", [h.host.id])).toHaveLength(0);
  });

  test("G-E14 la page exige une session", async ({ page }) => {
    await page.goto("/integrations");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("G-A accessibilité et mobile : non connecté, connecté, reconnexion ; 390 px sans débordement", async ({ page, browser }) => {
    const h = await makeHost();
    await login(page, h.email);
    await page.goto("/integrations");
    await expectAccessible(page);
    const small = await (await newContext(browser, { width: 390, height: 800 })).newPage();
    await login(small, h.email);
    await small.goto("/integrations");
    expect(await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Connecter Google Agenda" }).click();
    await expect(page.getByText("Google Agenda est connecté.")).toBeVisible();
    await expectAccessible(page);
    await small.goto("/integrations");
    expect(await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await control("revoke-all", { email: "host@gmail.test" });
    const et = await makeType(h.host);
    const g = await (await newContext(browser)).newPage();
    await g.goto(`/${h.username}/${et.slug}`);
    await g.getByLabel("Votre fuseau horaire").waitFor();
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: "Google Agenda : reconnexion nécessaire" })).toBeVisible();
    await expectAccessible(page);
  });
});
