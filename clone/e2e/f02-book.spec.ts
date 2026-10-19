// F02 : un invité réserve un créneau
import { test, expect, expectAccessible } from "./fixtures.ts";
import { bookDirect, bookFirst, fillGuest, login, makeHost, makeType, newContext, pickSlot, sql, waitForMail } from "./helpers.ts";

const open = async (page: import("@playwright/test").Page, path: string) => {
  await page.goto(path);
  await page.getByLabel("Votre fuseau horaire").waitFor();
};
const confirm = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /^Confirmer/ });
const count = async (hostId: string, where = "true") => (await sql<{ n: number }>(`select count(*)::int n from bookings where host_id = $1 and ${where}`, [hostId]))[0].n;

test.describe("F02 réservation par l'invité", () => {
  test("F02-H1 parcours nominal : confirmation, réservation visible côté hôte, e-mails", async ({ page, browser }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host, { name: "Découverte" });
    const { email: guestEmail } = await bookFirst(page, `/${username}/${et.slug}`, "Camille Durand");
    await expect(page.getByText("C'est confirmé")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Découverte" })).toBeVisible();
    await expect(page.getByText("Camille Durand")).toBeVisible();
    const hostCtx = await newContext(browser); const h = await hostCtx.newPage();
    await login(h, email);
    await h.goto("/bookings");
    await expect(h.getByText("Camille Durand")).toBeVisible();
    await expect(h.getByRole("link", { name: "À venir (1)" })).toBeVisible();
    const [toGuest] = await waitForMail("to_address = $1", [guestEmail]);
    expect(toGuest.subject).toMatch(/Rendez-vous confirmé/);
    const [toHost] = await waitForMail("to_address = $1 and subject like 'Nouvelle%'", [email]);
    expect(toHost.subject).toContain("Camille Durand");
  });

  test("F02-H2 invité dans un autre fuseau : heures affichées dans son fuseau, stockées en UTC", async ({ browser }) => {
    const { host, username } = await makeHost("Europe/Paris");
    const et = await makeType(host);
    const ctx = await newContext(browser, { tz: "America/Los_Angeles" });
    const page = await ctx.newPage();
    await open(page, `/${username}/${et.slug}`);
    await expect(page.getByLabel("Votre fuseau horaire")).toHaveValue("America/Los_Angeles");
    await pickSlot(page, 0);
    const shown = (await page.getByRole("button", { name: /^Confirmer le/ }).textContent())!;
    await fillGuest(page, "Léa Pacific", "lea@example.test");
    await confirm(page).click();
    await page.waitForURL("**/booking/**");
    const [b] = await sql<{ start_at: Date; guest_timezone: string }>("select start_at, guest_timezone from bookings where host_id = $1", [host.id]);
    expect(b.guest_timezone).toBe("America/Los_Angeles");
    const local = new Intl.DateTimeFormat("fr-FR", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit" }).format(b.start_at);
    expect(shown).toContain(local);
    const [mail] = await waitForMail("to_address = 'lea@example.test'");
    expect(mail.body_text).toMatch(/PDT|PST|UTC−|GMT−/);
  });

  test("F02-E1 créneau pris pendant la saisie : message clair, autre créneau possible, jamais de double réservation", async ({ browser }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    const a = await (await newContext(browser)).newPage();
    const b = await (await newContext(browser)).newPage();
    await open(a, `/${username}/${et.slug}`); await open(b, `/${username}/${et.slug}`);
    await pickSlot(a, 0); await pickSlot(b, 0);
    const takenTime = (await b.locator("section[aria-label^='Créneaux'] ul button").first().textContent())!;
    const tag = Math.random().toString(36).slice(2, 8); // adresses uniques : la limite de débit est par adresse
    await fillGuest(a, "Premier", `premier-${tag}@example.test`); await fillGuest(b, "Second", `second-${tag}@example.test`);
    await confirm(a).click();
    await a.waitForURL("**/booking/**");
    await confirm(b).click();
    await expect(b.getByRole("alert").filter({ hasText: /vient d'être pris|n'est plus proposé/ })).toBeVisible();
    await expect(confirm(b)).toHaveCount(0); // le créneau est désélectionné
    // la liste se met à jour : le créneau pris disparaît (on attend ce rafraîchissement avant de choisir)
    await expect(b.locator("section[aria-label^='Créneaux'] ul button").first()).not.toHaveText(takenTime);
    await b.locator("section[aria-label^='Créneaux'] ul button").first().click(); // un autre créneau est proposé
    await confirm(b).click();
    await b.waitForURL("**/booking/**");
    expect(await count(host.id)).toBe(2);
    const slots = await sql<{ start_at: Date }>("select distinct start_at from bookings where host_id = $1", [host.id]);
    expect(slots).toHaveLength(2);
  });

  test("F02-E2 double clic sur « Confirmer » : une seule réservation", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    await open(page, `/${username}/${et.slug}`);
    await pickSlot(page);
    await fillGuest(page, "Double Clic", "double@example.test");
    await confirm(page).dblclick();
    await page.waitForURL("**/booking/**");
    await page.waitForTimeout(800);
    expect(await count(host.id)).toBe(1);
    const mails = await waitForMail("to_address = 'double@example.test'", [], 1);
    expect(mails).toHaveLength(1);
  });

  test("F02-E3 deux onglets du même invité sur le même créneau : une réservation, l'autre refusée", async ({ context }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    const a = await context.newPage(), b = await context.newPage();
    await open(a, `/${username}/${et.slug}`); await open(b, `/${username}/${et.slug}`);
    await pickSlot(a); await pickSlot(b);
    await fillGuest(a, "Même Personne", "meme@example.test"); await fillGuest(b, "Même Personne", "meme@example.test");
    await Promise.all([confirm(a).click(), confirm(b).click()]);
    await expect.poll(() => count(host.id)).toBe(1);
    const outcomes = await Promise.all([a, b].map(async (p) => /\/booking\//.test(p.url()) || (await p.getByRole("alert").count()) > 0));
    expect(outcomes.every(Boolean)).toBe(true);
  });

  test("F02-E4 contenu hostile : nom avec balises affiché tel quel, jamais interprété", async ({ page, browser }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host);
    const evil = `<img src=x onerror="window.__pwn=1"> <script>window.__pwn=2</script>`;
    await open(page, `/${username}/${et.slug}`);
    await pickSlot(page);
    await fillGuest(page, evil, "evil@example.test");
    await confirm(page).click();
    await page.waitForURL("**/booking/**");
    await expect(page.getByText(evil)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)).toBeUndefined();
    const h = await (await newContext(browser)).newPage();
    await login(h, email);
    await h.goto("/bookings");
    await expect(h.getByText(evil)).toBeVisible();
    expect(await h.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)).toBeUndefined();
  });

  test("F02-E5 accents, emoji, adresse avec « + » et nom de 120 caractères", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    await open(page, `/${username}/${et.slug}`);
    await pickSlot(page);
    const longName = "Éloïse-Zoë 😀 " + "N".repeat(106);
    await fillGuest(page, longName, "zoe+rdv@example.test");
    await confirm(page).click();
    await page.waitForURL("**/booking/**");
    const [b] = await sql<{ guest_name: string; guest_email: string }>("select guest_name, guest_email from bookings where host_id = $1", [host.id]);
    expect(b.guest_name).toBe(longName);
    expect(b.guest_email).toBe("zoe+rdv@example.test");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const [mail] = await waitForMail("to_address = 'zoe+rdv@example.test'");
    expect(mail).toBeTruthy();
  });

  test("F02-E6 rafraîchir au milieu du parcours puis recommencer fonctionne ; retour arrière après confirmation ne duplique rien", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    await open(page, `/${username}/${et.slug}`);
    await pickSlot(page);
    await fillGuest(page, "Rafraîchi", "refresh@example.test");
    await page.reload();
    await page.getByLabel("Votre fuseau horaire").waitFor();
    await expect(confirm(page)).toHaveCount(0); // le formulaire repart de zéro, sans plantage
    await pickSlot(page);
    await fillGuest(page, "Rafraîchi", "refresh@example.test");
    await confirm(page).click();
    await page.waitForURL("**/booking/**");
    await page.goBack();
    await page.getByLabel("Votre fuseau horaire").waitFor();
    await page.goForward();
    await expect(page.getByText("C'est confirmé")).toBeVisible();
    await page.reload();
    await expect(page.getByText("C'est confirmé")).toBeVisible();
    expect(await count(host.id)).toBe(1);
  });

  test("F02-E7 hors connexion : message clair, rien n'est créé, réessayer fonctionne", async ({ page, context }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    await open(page, `/${username}/${et.slug}`);
    await pickSlot(page);
    await fillGuest(page, "Hors Ligne", "offline@example.test");
    await context.setOffline(true);
    await confirm(page).click();
    await expect(page.getByText("Impossible de joindre le serveur")).toBeVisible({ timeout: 10_000 });
    await expect(confirm(page)).toBeEnabled();
    expect(await count(host.id)).toBe(0);
    await context.setOffline(false);
    await confirm(page).click();
    await page.waitForURL("**/booking/**");
    expect(await count(host.id)).toBe(1);
  });

  test("F02-E8 réseau lent : bouton occupé, une seule réservation", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    await open(page, `/${username}/${et.slug}`);
    await pickSlot(page);
    await fillGuest(page, "Lent", "lent@example.test");
    await page.route("**/*", async (route) => { if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
    await confirm(page).click();
    await expect(confirm(page)).toBeDisabled();
    await confirm(page).click({ force: true, trial: false }).catch(() => {});
    await page.waitForURL("**/booking/**", { timeout: 15_000 });
    expect(await count(host.id)).toBe(1);
  });

  test("F02-E9 questions : obligatoires refusées en gardant la saisie, réponses enregistrées", async ({ page, browser }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host, { questions: [
      { id: "q1", label: "Votre rôle", kind: "select", options: ["Responsable", "Contributeur"], required: true },
      { id: "q2", label: "J'accepte les conditions", kind: "checkbox", options: [], required: true },
      { id: "q3", label: "Un commentaire", kind: "textarea", options: [], required: false },
    ] });
    await open(page, `/${username}/${et.slug}`);
    await pickSlot(page);
    await fillGuest(page, "Question", "q@example.test");
    await page.getByLabel("Un commentaire").fill("Bonjour 😀");
    await confirm(page).click();
    await expect(page.getByText("Cette réponse est obligatoire.").first()).toBeVisible();
    await expect(page.getByLabel("Un commentaire")).toHaveValue("Bonjour 😀");
    await page.getByLabel(/Votre rôle/).selectOption("Contributeur");
    await page.getByLabel(/J'accepte/).check();
    await confirm(page).click();
    await page.waitForURL("**/booking/**");
    await expect(page.getByText("Contributeur")).toBeVisible();
    const h = await (await newContext(browser)).newPage();
    await login(h, email);
    await h.goto("/bookings");
    await h.getByText(/Réponses \(3\)/).click();
    await expect(h.getByText("Bonjour 😀")).toBeVisible();
  });

  test("F02-E10 redirection personnalisée après la réservation", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host, { confirmationRedirectUrl: "https://example.com/merci" });
    await page.route("https://example.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>Merci</h1>" }));
    await open(page, `/${username}/${et.slug}`);
    await pickSlot(page);
    await fillGuest(page, "Redirigé", "redir@example.test");
    await confirm(page).click();
    await page.waitForURL("https://example.com/**");
    expect(await count(host.id)).toBe(1);
  });

  test("F02-E11 préavis de 7 jours : aucun créneau avant", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host, { minNoticeMinutes: 7 * 24 * 60 });
    await open(page, `/${username}/${et.slug}`);
    const first = page.locator("section[aria-label='Choisir une date'] button[aria-pressed]:not([disabled])").first();
    await first.click();
    const slots = await page.locator("section[aria-label^='Créneaux'] ul button").count();
    expect(slots).toBeGreaterThan(0);
    await pickSlot(page);
    await fillGuest(page, "Préavis", "preavis@example.test");
    await confirm(page).click();
    await page.waitForURL("**/booking/**");
    const [b] = await sql<{ start_at: Date }>("select start_at from bookings where host_id = $1", [host.id]);
    expect(b.start_at.getTime()).toBeGreaterThanOrEqual(Date.now() + 7 * 24 * 3600_000);
  });

  test("F02-E12 limite d'un rendez-vous par jour : les autres créneaux du jour disparaissent", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host, { limitPerDay: 1 });
    await open(page, `/${username}/${et.slug}`);
    await pickSlot(page);
    const dayLabel = await page.locator("section[aria-label='Choisir une date'] button[aria-pressed='true']").getAttribute("aria-label");
    await fillGuest(page, "Limite", "limite@example.test");
    await confirm(page).click();
    await page.waitForURL("**/booking/**");
    await open(page, `/${username}/${et.slug}`);
    const day = dayLabel!.split(",")[0];
    await expect(page.locator(`section[aria-label='Choisir une date'] button[aria-label^='${day},']:not([disabled])`)).toHaveCount(0);
  });

  test("F02-E13 fuseau extrême (UTC+14) : pas de plantage, jours cohérents", async ({ browser }) => {
    const { host, username } = await makeHost("Europe/Paris");
    const et = await makeType(host);
    const page = await (await newContext(browser, { tz: "Pacific/Kiritimati" })).newPage();
    await open(page, `/${username}/${et.slug}`);
    await expect(page.getByLabel("Votre fuseau horaire")).toHaveValue("Pacific/Kiritimati");
    await pickSlot(page);
    await fillGuest(page, "Très Loin", "loin@example.test");
    await confirm(page).click();
    await page.waitForURL("**/booking/**");
    await expect(page.getByText("Pacific/Kiritimati")).toBeVisible();
  });

  test("F02-E14 l'invité change de fuseau dans la page : les heures se recalculent", async ({ browser }) => {
    const { host, username } = await makeHost("Europe/Paris");
    const et = await makeType(host);
    const page = await (await newContext(browser, { tz: "Europe/Paris" })).newPage();
    await open(page, `/${username}/${et.slug}`);
    // 5e jour disponible : une journée entière, quelle que soit l'heure à laquelle le test s'exécute
    await page.locator("section[aria-label='Choisir une date'] button[aria-pressed]:not([disabled])").nth(4).click();
    const parisFirst = await page.locator("section[aria-label^='Créneaux'] ul button").first().textContent();
    await page.getByLabel("Votre fuseau horaire").selectOption("Asia/Tokyo");
    await page.locator("section[aria-label='Choisir une date'] button[aria-pressed]:not([disabled])").nth(4).click();
    const tokyoFirst = await page.locator("section[aria-label^='Créneaux'] ul button").first().textContent();
    expect(parisFirst).toBe("09:00");
    expect(tokyoFirst).not.toBe(parisFirst);
  });

  test("F02-N1 coordonnées invalides : messages clairs, aucune réservation", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    await open(page, `/${username}/${et.slug}`);
    await pickSlot(page);
    await confirm(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "Indiquez votre nom" })).toBeVisible();
    await fillGuest(page, "Nom Valide", "pas-un-email");
    await confirm(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "ne semble pas valide" })).toBeVisible();
    expect(await count(host.id)).toBe(0);
  });

  test("F02-N2 liens invalides : hôte inconnu, type inconnu, type inactif → 404", async ({ page }) => {
    const { host, username } = await makeHost();
    const off = await makeType(host, { name: "Éteint", active: false } as never);
    await sql("update event_types set active = false where id = $1", [off.id]);
    expect((await page.goto("/personne-nexiste-pas"))!.status()).toBe(404);
    expect((await page.goto(`/${username}/inconnu`))!.status()).toBe(404);
    expect((await page.goto(`/${username}/${off.slug}`))!.status()).toBe(404);
    expect((await page.goto("/booking/jeton-invalide"))!.status()).toBe(404);
  });

  test("F02-N4 limite de débit : au-delà de 10 réservations par heure pour une même adresse, message clair", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host, { minNoticeMinutes: 0 });
    const guest = `rafale-${Math.random().toString(36).slice(2, 8)}@example.test`;
    let blocked = false;
    for (let i = 0; i < 12 && !blocked; i++) {
      await open(page, `/${username}/${et.slug}`);
      await pickSlot(page);
      await fillGuest(page, "Rafale", guest);
      await confirm(page).click();
      await Promise.race([
        page.waitForURL("**/booking/**"),
        page.getByRole("alert").filter({ hasText: "Trop de réservations" }).waitFor().then(() => { blocked = true; }),
      ]);
    }
    expect(blocked, "la limite doit se déclencher avant la 12e réservation").toBe(true);
    expect(await count(host.id)).toBeLessThanOrEqual(10);
    await expect(confirm(page)).toBeEnabled(); // l'invité peut corriger et réessayer plus tard
  });

  test("F02-N3 nom d'utilisateur dans l'URL avec des majuscules : la page s'ouvre", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    const res = await page.goto(`/${username.toUpperCase()}/${et.slug}`);
    expect(res!.status(), "les liens collés avec une majuscule devraient fonctionner").toBe(200);
  });

  test("F02-M parcours complet en 390 px sans débordement", async ({ browser }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    const page = await (await newContext(browser, { width: 390, height: 844 })).newPage();
    await open(page, `/${username}/${et.slug}`);
    await pickSlot(page);
    await fillGuest(page, "Mobile", "mobile@example.test");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await confirm(page).click();
    await page.waitForURL("**/booking/**");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("F02-K parcours au clavier seul", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    await open(page, `/${username}/${et.slug}`);
    await page.locator("section[aria-label='Choisir une date'] button[aria-pressed]:not([disabled])").first().focus();
    await page.keyboard.press("Enter");
    await page.locator("section[aria-label^='Créneaux'] ul button").first().focus();
    await page.keyboard.press("Enter");
    await page.getByLabel("Nom", { exact: true }).focus();
    await page.keyboard.type("Clavier Seul");
    await page.keyboard.press("Tab");
    await page.keyboard.type("clavier@example.test");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/booking/**");
    expect(await count(host.id)).toBe(1);
  });

  test("F02-A accessibilité : accueil de l'hôte, page de réservation, formulaire, confirmation", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host, { questions: [{ id: "q1", label: "Une question", kind: "text", options: [], required: false }] });
    await page.goto(`/${username}`);
    await expectAccessible(page);
    await open(page, `/${username}/${et.slug}`);
    await expectAccessible(page);
    await pickSlot(page);
    await expectAccessible(page);
    await fillGuest(page, "Accessible", "a11y@example.test");
    await confirm(page).click();
    await page.waitForURL("**/booking/**");
    await expect(page.getByText("C'est confirmé")).toBeVisible(); // attendre le contenu : le titre est posé après la navigation
    await expectAccessible(page);
    await bookDirect(host, et, 3);
  });
});
