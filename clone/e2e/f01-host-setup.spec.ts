// F01 : l'hôte met en place son lien (inscription → type d'événement → disponibilités → page publique)
import { test, expect, expectAccessible } from "./fixtures.ts";
import { bookDirect, login, makeHost, makeType, PASSWORD, sql, waitForMail } from "./helpers.ts";

test.describe("F01 mise en place de l'hôte", () => {
  test("F01-H1 parcours complet : inscription, confirmation, connexion, type, lien public", async ({ page, context }) => {
    const u = `nina${Date.now().toString(36)}`;
    await page.goto("/signup");
    await page.getByLabel("Votre nom").fill("Nina Roche");
    await page.getByLabel(/Nom dans votre lien/).fill(u);
    await page.getByLabel("Adresse e-mail").fill(`${u}@example.test`);
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByRole("heading", { name: "Vérifiez votre boîte e-mail" })).toBeVisible();
    const [mail] = await waitForMail("to_address = $1", [`${u}@example.test`]);
    await page.goto(mail.body_text.match(/http\S+/)![0]);
    await page.getByRole("button", { name: "Confirmer mon adresse" }).click();
    await expect(page.getByText("Adresse confirmée")).toBeVisible();
    await page.getByLabel("Adresse e-mail").fill(`${u}@example.test`);
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL("**/event-types");
    await expect(page.getByRole("heading", { name: "Aucun type d'événement pour l'instant" })).toBeVisible();
    await page.getByRole("link", { name: "Créer le premier" }).click();
    await page.getByLabel("Nom", { exact: true }).fill("Première rencontre");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL("**/event-types");
    // un visiteur sans compte voit la page publique et peut réserver
    const guest = await context.browser()!.newContext({ locale: "fr-FR" });
    const g = await guest.newPage();
    await g.goto(`/${u}/premiere-rencontre`);
    await expect(g.getByRole("heading", { name: "Première rencontre" })).toBeVisible();
    await expect(g.locator("section[aria-label='Choisir une date'] button[aria-pressed]:not([disabled])").first()).toBeVisible();
    await guest.close();
  });

  test("F01-H2 modifier un type garde son lien et met à jour la page publique", async ({ page, browser }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host, { name: "Avant", description: "Ancienne description" });
    await login(page, email);
    await page.goto(`/event-types/${et.id}/edit`);
    await page.getByLabel("Nom", { exact: true }).fill("Après");
    await page.getByLabel("Description").fill("Nouvelle description");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL("**/event-types");
    const g = await (await browser.newContext()).newPage();
    await g.goto(`/${username}/${et.slug}`);
    await expect(g.getByRole("heading", { name: "Après" })).toBeVisible();
    await expect(g.getByText("Nouvelle description")).toBeVisible();
  });

  test("F01-H3 plages hebdomadaires : un seul jour ouvré avec une plage → seuls ces jours sont réservables", async ({ page, browser }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host);
    await login(page, email);
    await page.goto("/availability");
    for (const d of ["Mardi", "Mercredi", "Jeudi", "Vendredi"]) await page.getByLabel(d, { exact: true }).uncheck();
    await page.getByLabel("Lundi, plage 1, début").fill("10:00");
    await page.getByLabel("Lundi, plage 1, fin").fill("11:00");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Disponibilités enregistrées")).toBeVisible();
    const g = await (await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" })).newPage();
    await g.goto(`/${username}/${et.slug}`);
    const enabled = g.locator("section[aria-label='Choisir une date'] button[aria-pressed]:not([disabled])");
    await expect(enabled.first()).toBeVisible();
    for (const label of await enabled.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))) expect(label).toMatch(/^lundi/);
    await enabled.first().click();
    await expect(g.locator("section[aria-label^='Créneaux'] ul button")).toHaveText(["10:00", "10:30"]);
  });

  test("F01-H4 exception : un jour indisponible n'est plus réservable", async ({ page, browser }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host);
    const { listSlots } = await import("../lib/store.ts");
    const target = (await listSlots(host, et))[0].slice(0, 10);
    await login(page, email);
    await page.goto("/availability");
    await page.getByRole("button", { name: "Ajouter une exception" }).click();
    await page.getByLabel("Date", { exact: true }).fill(target);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Disponibilités enregistrées")).toBeVisible();
    expect((await listSlots(host, et)).some((s) => s.startsWith(target))).toBe(false);
    void username; void browser;
  });

  test("F01-H5 changer de fuseau décale les créneaux proposés", async ({ page }) => {
    const { host, email } = await makeHost("Europe/Paris");
    const et = await makeType(host);
    const { listSlots } = await import("../lib/store.ts");
    const before = (await listSlots(host, et))[0];
    await login(page, email);
    await page.goto("/availability");
    await page.getByLabel("Votre fuseau horaire").selectOption("Asia/Tokyo");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Disponibilités enregistrées")).toBeVisible();
    const { getHostById } = await import("../lib/store.ts");
    const after = (await listSlots((await getHostById(host.id))!, et))[0];
    expect(after).not.toBe(before);
    expect(new Date(after).getUTCHours()).toBe(0); // 09:00 à Tokyo = 00:00 UTC
  });

  test("F01-E1 nom : vide refusé, 80 caractères acceptés, saisie conservée après erreur", async ({ page }) => {
    const { email } = await makeHost();
    await login(page, email);
    await page.goto("/event-types/new");
    await page.getByLabel("Marge après (minutes)").fill("20");
    await page.getByLabel("Description").fill("Une description à garder");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Donnez un nom à ce type d'événement.")).toBeVisible();
    await expect(page.getByLabel("Marge après (minutes)")).toHaveValue("20");
    await expect(page.getByLabel("Description")).toHaveValue("Une description à garder");
    const long = "A".repeat(80);
    await page.getByLabel("Nom", { exact: true }).fill(long);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL("**/event-types");
    await expect(page.getByRole("heading", { name: long })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("F01-E2 accents et emoji : le nom est conservé, le lien est propre", async ({ page }) => {
    const { host, email } = await makeHost();
    await login(page, email);
    await page.goto("/event-types/new");
    await page.getByLabel("Nom", { exact: true }).fill("Café ☕ à l'écoute — été");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL("**/event-types");
    await expect(page.getByRole("heading", { name: "Café ☕ à l'écoute — été" })).toBeVisible();
    const rows = await sql<{ slug: string }>("select slug from event_types where owner_id = $1", [host.id]);
    expect(rows[0].slug).toBe("cafe-a-l-ecoute-ete");
  });

  test("F01-E3 deux types au même nom obtiennent deux liens distincts", async ({ page }) => {
    const { host, email } = await makeHost();
    await login(page, email);
    for (let i = 0; i < 2; i++) {
      await page.goto("/event-types/new");
      await page.getByLabel("Nom", { exact: true }).fill("Doublon");
      await page.getByRole("button", { name: "Enregistrer" }).click();
      await page.waitForURL("**/event-types");
    }
    const slugs = (await sql<{ slug: string }>("select slug from event_types where owner_id = $1 order by slug", [host.id])).map((r) => r.slug);
    expect(slugs).toEqual(["doublon", "doublon-2"]);
  });

  test("F01-E4 règles : valeurs conservées au rechargement ; limite semaine < jour refusée sans perdre la saisie", async ({ page }) => {
    const { host, email } = await makeHost();
    const et = await makeType(host);
    await login(page, email);
    await page.goto(`/event-types/${et.id}/edit`);
    await page.getByLabel("Marge avant (minutes)").fill("10");
    await page.getByLabel("Marge après (minutes)").fill("15");
    await page.getByLabel("Maximum par jour").fill("5");
    await page.getByLabel("Maximum par semaine").fill("3");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("ne peut pas être inférieure")).toBeVisible();
    await expect(page.getByLabel("Marge avant (minutes)")).toHaveValue("10");
    await page.getByLabel("Maximum par semaine").fill("10");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL("**/event-types");
    await page.goto(`/event-types/${et.id}/edit`);
    await expect(page.getByLabel("Marge avant (minutes)")).toHaveValue("10");
    await expect(page.getByLabel("Marge après (minutes)")).toHaveValue("15");
    await expect(page.getByLabel("Maximum par jour")).toHaveValue("5");
    await expect(page.getByLabel("Maximum par semaine")).toHaveValue("10");
  });

  test("F01-E5 suppression : refusée avec réservations, acceptée sans, lien public ensuite en 404", async ({ page, browser }) => {
    const { host, email, username } = await makeHost();
    const used = await makeType(host, { name: "Utilisé" });
    const free = await makeType(host, { name: "Libre" });
    await bookDirect(host, used);
    await login(page, email);
    await page.getByRole("button", { name: "Supprimer Utilisé" }).click();
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText("désactivez-le plutôt")).toBeVisible();
    await page.getByRole("button", { name: "Supprimer Libre" }).click();
    await page.getByRole("group", { name: /suppression de Libre/ }).getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByRole("heading", { name: "Libre" })).toHaveCount(0);
    const g = await (await browser.newContext()).newPage();
    expect((await g.goto(`/${username}/${free.slug}`))!.status()).toBe(404);
    expect((await g.goto(`/${username}/${used.slug}`))!.status()).toBe(200);
  });

  test("F01-E6 type inactif : absent de la page publique et en 404 ; réactivé, il revient", async ({ page, browser }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host, { name: "Interrupteur" });
    await login(page, email);
    await page.getByRole("button", { name: "Désactiver" }).click();
    await expect(page.getByText("Inactif")).toBeVisible();
    const g = await (await browser.newContext()).newPage();
    expect((await g.goto(`/${username}/${et.slug}`))!.status()).toBe(404);
    await g.goto(`/${username}`);
    await expect(g.getByText("Aucun rendez-vous disponible")).toBeVisible();
    await page.getByRole("button", { name: "Activer" }).click();
    await expect(page.getByText("Actif", { exact: true })).toBeVisible();
    expect((await g.goto(`/${username}/${et.slug}`))!.status()).toBe(200);
  });

  test("F01-E7 aucun jour ouvré : la page publique affiche un état vide", async ({ page, browser }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host);
    await login(page, email);
    await page.goto("/availability");
    for (const d of ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]) await page.getByLabel(d, { exact: true }).uncheck();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Disponibilités enregistrées")).toBeVisible();
    const g = await (await browser.newContext()).newPage();
    await g.goto(`/${username}/${et.slug}`);
    await expect(g.getByRole("heading", { name: "Aucun créneau libre pour le moment" })).toBeVisible();
  });

  test("F01-E8 questions : liste à choix avec une seule option refusée, saisie conservée", async ({ page }) => {
    const { host, email } = await makeHost();
    const et = await makeType(host);
    await login(page, email);
    await page.goto(`/event-types/${et.id}/edit`);
    await page.getByRole("button", { name: "Ajouter une question" }).click();
    await page.getByLabel("Intitulé 1").fill("Votre rôle");
    await page.getByLabel("Type", { exact: true }).selectOption("select");
    await page.getByLabel("Choix (un par ligne)").fill("Un seul");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("proposez entre 2 et 20 choix")).toBeVisible();
    await expect(page.getByLabel("Intitulé 1")).toHaveValue("Votre rôle");
    await page.getByLabel("Choix (un par ligne)").fill("Un\nDeux");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL("**/event-types");
  });

  test("F01-N1 inscription : mot de passe faible, nom pris, nom réservé, e-mail invalide", async ({ page }) => {
    const { username } = await makeHost();
    await page.goto("/signup");
    const fill = async (name: string, user: string, email: string, pw: string) => {
      await page.getByLabel("Votre nom").fill(name);
      await page.getByLabel(/Nom dans votre lien/).fill(user);
      await page.getByLabel("Adresse e-mail").fill(email);
      await page.getByLabel("Mot de passe").fill(pw);
      await page.getByRole("button", { name: "Créer mon compte" }).click();
    };
    await fill("Test", "bonnom", "pas-un-email", "court");
    await expect(page.getByText("Cette adresse e-mail ne semble pas valide.")).toBeVisible();
    await expect(page.getByText("Choisissez au moins 10 caractères.")).toBeVisible();
    await expect(page.getByLabel("Votre nom")).toHaveValue("Test"); // la saisie n'est pas effacée
    await fill("Test", "account", "ok@example.test", PASSWORD);
    await expect(page.getByText("Ce nom est réservé")).toBeVisible();
    await fill("Test", username, "ok@example.test", PASSWORD);
    await expect(page.getByText("Ce nom est déjà pris.")).toBeVisible();
  });

  test("F01-E9 mot de passe : 128 caractères acceptés, 129 refusés, Unicode accepté", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Votre nom").fill("Longue Phrase");
    await page.getByLabel(/Nom dans votre lien/).fill(`lp${Date.now().toString(36)}`);
    await page.getByLabel("Adresse e-mail").fill(`lp${Date.now().toString(36)}@example.test`);
    await page.getByLabel("Mot de passe").fill("é".repeat(129));
    // le champ plafonne à 128 caractères (maxlength) : pas de saisie possible au-delà
    expect((await page.getByLabel("Mot de passe").inputValue()).length).toBe(128);
    await page.getByLabel("Mot de passe").fill("pässwörd-😀-" + "x".repeat(20));
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByRole("heading", { name: "Vérifiez votre boîte e-mail" })).toBeVisible();
  });

  test("F01-A accessibilité des écrans de l'hôte", async ({ page }) => {
    const { host, email } = await makeHost();
    const et = await makeType(host, { name: "Accessible" });
    await login(page, email);
    for (const path of ["/event-types", "/event-types/new", `/event-types/${et.id}/edit`, "/availability", "/bookings", "/account"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expectAccessible(page);
    }
  });
});
