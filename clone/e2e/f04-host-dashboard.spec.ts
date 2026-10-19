// F04 : l'hôte consulte et gère ses réunions ; cloisonnement entre comptes ; session
import { test, expect, expectAccessible } from "./fixtures.ts";
import { bookDirect, login, makeHost, makeType, newContext, sql, waitForMail } from "./helpers.ts";

test.describe("F04 tableau de bord de l'hôte", () => {
  test("F04-H1 onglets avec compteurs ; l'hôte annule, la réunion passe dans « Annulées », e-mails envoyés", async ({ page }) => {
    const { host, email } = await makeHost();
    const et = await makeType(host);
    const b1 = await bookDirect(host, et, 0, "un@example.test");
    await bookDirect(host, et, 3, "deux@example.test");
    await sql(`insert into bookings (event_type_id, host_id, start_at, end_at, guest_name, guest_email, guest_timezone)
      values ($1,$2, now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', 'Passée', 'passee@example.test','UTC')`, [et.id, host.id]);
    await login(page, email);
    await page.goto("/bookings");
    await expect(page.getByRole("link", { name: "À venir (2)" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Passées (1)" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Annulées (0)" })).toBeVisible();
    await page.getByRole("button", { name: /Annuler la réunion avec Invité direct/ }).first().click();
    await expect(page.getByRole("link", { name: "À venir (1)" })).toBeVisible();
    await page.getByRole("link", { name: /Annulées \(1\)/ }).click();
    await expect(page.getByText("Invité direct")).toBeVisible();
    expect(await waitForMail("to_address = 'un@example.test' and subject like 'Rendez-vous annulé%'")).toHaveLength(1);
    void b1;
  });

  test("F04-E1 états vides de chaque onglet", async ({ page }) => {
    const { email } = await makeHost();
    await login(page, email);
    for (const [vue, titre] of [["a-venir", "Aucune réunion à venir"], ["passees", "Aucune réunion passée"], ["annulees", "Aucune réunion annulée"]]) {
      await page.goto(`/bookings?vue=${vue}`);
      await expect(page.getByRole("heading", { name: titre })).toBeVisible();
    }
    await page.goto("/bookings?vue=nimporte-quoi");
    await expect(page.getByRole("heading", { name: "Aucune réunion à venir" })).toBeVisible();
  });

  test("F04-E2 cloisonnement : un autre hôte ne voit, n'ouvre ni n'annule rien", async ({ page, browser }) => {
    const a = await makeHost(), b = await makeHost();
    const etA = await makeType(a.host, { name: "Secret d'Alice" });
    await bookDirect(a.host, etA, 0, "client-alice@example.test");
    await login(page, b.email);
    await page.goto("/event-types");
    await expect(page.getByText("Secret d'Alice")).toHaveCount(0);
    await page.goto("/bookings");
    await expect(page.getByText("Invité direct")).toHaveCount(0);
    expect((await page.goto(`/event-types/${etA.id}/edit`))!.status()).toBe(404);
    // la page publique d'Alice reste publique
    const pub = await (await newContext(browser)).newPage();
    expect((await pub.goto(`/${a.username}/${etA.slug}`))!.status()).toBe(200);
  });

  test("F04-E3 session expirée : les pages protégées renvoient à la connexion, la saisie en cours n'est pas un plantage", async ({ page }) => {
    const { email } = await makeHost();
    await login(page, email);
    await page.goto("/event-types/new");
    await page.getByLabel("Nom", { exact: true }).fill("Brouillon");
    await sql("delete from sessions");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL("**/login");
    await page.goto("/bookings");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("F04-E4 déconnexion dans un onglet : l'autre onglet est renvoyé à la connexion au prochain clic", async ({ context }) => {
    const { email } = await makeHost();
    const a = await context.newPage(), b = await context.newPage();
    await login(a, email);
    await b.goto("/availability");
    await a.getByRole("button", { name: "Se déconnecter" }).click();
    await a.waitForURL("**/login");
    await b.getByRole("button", { name: "Enregistrer" }).click();
    await b.waitForURL("**/login");
  });

  test("F04-E6 tableau des réunions à 390 px : une adresse e-mail courte reste sur une ligne", async ({ browser }) => {
    const { host, email } = await makeHost();
    const et = await makeType(host);
    await bookDirect(host, et, 0, "court@example.test");
    const page = await (await newContext(browser, { width: 390, height: 800 })).newPage();
    await login(page, email);
    await page.goto("/bookings");
    const box = await page.getByText("court@example.test").boundingBox();
    expect(box!.height, "l'adresse est coupée au milieu (colonne trop étroite)").toBeLessThan(30);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("F04-E5 nom d'invité très long sans espace : pas de débordement horizontal à 390 px", async ({ browser }) => {
    const { host, email } = await makeHost();
    const et = await makeType(host, { name: "Un type au nom aussi long que possible " + "m".repeat(30) });
    await sql(`insert into bookings (event_type_id, host_id, start_at, end_at, guest_name, guest_email, guest_timezone)
      values ($1,$2, now() + interval '2 days', now() + interval '2 days' + interval '30 minutes', $3, $4, 'UTC')`, [et.id, host.id, "Z".repeat(115), `${"y".repeat(60)}@example.test`]);
    const page = await (await newContext(browser, { width: 390, height: 800 })).newPage();
    await login(page, email);
    for (const path of ["/event-types", "/bookings"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `débordement sur ${path}`).toBe(true);
    }
    // le correctif du débordement ne doit pas casser le texte de l'interface : le bouton et la date restent lisibles
    await page.goto("/bookings");
    const cancel = await page.getByRole("button", { name: /Annuler la réunion/ }).first().boundingBox();
    expect(cancel!.height, "le bouton « Annuler » ne doit pas s'empiler lettre par lettre").toBeLessThan(60);
    const lines = await page.getByRole("row").first().getByRole("cell").first().evaluate((td) => {
      const r = document.createRange();
      r.selectNodeContents(td);
      return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; // nombre de lignes de texte
    });
    expect(lines, "la date ne doit pas être coupée au milieu des mots (lignes de texte)").toBeLessThanOrEqual(6);
  });

  test("F04-E7 réunions : cartes empilées sur mobile (sans en-têtes), tableau sur grand écran", async ({ browser }) => {
    const { host, email } = await makeHost();
    const et = await makeType(host);
    await bookDirect(host, et, 0, "un@example.test");
    await bookDirect(host, et, 3, "deux@example.test");
    const small = await (await newContext(browser, { width: 390, height: 800 })).newPage();
    await login(small, email);
    await small.goto("/bookings");
    await expect(small.getByRole("columnheader", { name: "Quand" })).toBeHidden();
    const rows = small.getByRole("row");
    await expect(rows).toHaveCount(2); // une carte par réunion, pas de ligne d'en-tête
    const card = (await rows.first().boundingBox())!;
    expect(card.width, "la carte occupe la largeur de l'écran").toBeGreaterThan(390 - 64);
    const btn = (await small.getByRole("button", { name: /Annuler la réunion/ }).first().boundingBox())!;
    expect(btn.width, "le bouton « Annuler » est pleine largeur sur mobile").toBeGreaterThan(card.width * 0.7);
    expect(await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await small.locator("main .overflow-x-auto").count(), "plus de défilement horizontal interne").toBe(0);

    const wide = await (await newContext(browser, { width: 1280, height: 800 })).newPage();
    await login(wide, email);
    await wide.goto("/bookings");
    for (const h of ["Quand", "Invité", "Type"]) await expect(wide.getByRole("columnheader", { name: h })).toBeVisible();
    await expect(wide.getByRole("row")).toHaveCount(3); // en-tête + 2 réunions
    const wbtn = (await wide.getByRole("button", { name: /Annuler la réunion/ }).first().boundingBox())!;
    expect(wbtn.width, "sur grand écran le bouton garde sa taille naturelle").toBeLessThan(200);
  });

  test("F04-A accessibilité de la liste des réunions (cartes et tableau)", async ({ browser }) => {
    const { host, email } = await makeHost();
    const et = await makeType(host, { questions: [{ id: "q1", label: "Sujet", kind: "text", options: [], required: false }] });
    const { createBooking, listSlots } = await import("../lib/store.ts");
    await createBooking(host, et, { startAt: (await listSlots(host, et))[0], guestName: "Ada", guestEmail: "ada@example.test", guestTimezone: "UTC", answers: { q1: "Un sujet" } });
    await bookDirect(host, et, 3);
    for (const width of [390, 1280]) {
      const page = await (await newContext(browser, { width, height: 800 })).newPage();
      await login(page, email);
      for (const vue of ["a-venir", "annulees"]) {
        await page.goto(`/bookings?vue=${vue}`);
        await expect(page.getByRole("heading", { name: "Réunions" })).toBeVisible();
        await expectAccessible(page);
      }
    }
  });
});
