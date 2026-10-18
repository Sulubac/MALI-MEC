// F03 : l'invité annule ou replanifie sa réservation
import { test, expect, expectAccessible } from "./fixtures.ts";
import { bookDirect, bookFirst, login, makeHost, makeType, newContext, pickSlot, sql, waitForMail } from "./helpers.ts";

const confirmBtn = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /^Confirmer/ });

test.describe("F03 annulation et replanification par l'invité", () => {
  test("F03-H1 annulation avec motif : statut, e-mails aux deux, créneau libéré", async ({ page }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host);
    const { email: guestEmail } = await bookFirst(page, `/${username}/${et.slug}`, "Annie Guest");
    const [b] = await sql<{ start_at: Date }>("select start_at from bookings where host_id = $1", [host.id]);
    await page.getByLabel("Motif").fill("Empêchement de dernière minute");
    await page.getByRole("button", { name: "Annuler la réservation" }).click();
    await expect(page.getByText("Cette réservation est annulée")).toBeVisible();
    await expect(page.getByText("Empêchement de dernière minute")).toBeVisible();
    await expect(page.getByRole("button", { name: "Annuler la réservation" })).toHaveCount(0);
    const g = await waitForMail("to_address = $1 and subject like 'Rendez-vous annulé%'", [guestEmail]);
    const h = await waitForMail("to_address = $1 and subject like 'Réservation annulée%'", [email]);
    expect(g).toHaveLength(1); expect(h).toHaveLength(1);
    expect(h[0].body_text).toContain("Empêchement de dernière minute");
    const { listSlots } = await import("../lib/store.ts");
    expect((await listSlots(host, et)).includes(b.start_at.toISOString())).toBe(true);
  });

  test("F03-H2 replanification : nouvelle réservation, ancienne annulée, coordonnées préremplies", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    const { url, email: guestEmail } = await bookFirst(page, `/${username}/${et.slug}`, "Rita Replan");
    await page.getByRole("link", { name: "Choisir un autre créneau" }).click();
    await page.getByLabel("Votre fuseau horaire").waitFor();
    await expect(page.getByText("Vous choisissez un nouveau créneau")).toBeVisible();
    await pickSlot(page, 2);
    await expect(page.getByLabel("Nom", { exact: true })).toHaveValue("Rita Replan");
    await expect(page.getByLabel("Adresse e-mail")).toHaveValue(guestEmail);
    await confirmBtn(page).click();
    await page.waitForURL((u) => u.pathname.startsWith("/booking/") && u.toString() !== url);
    const rows = await sql<{ status: string }>("select status from bookings where host_id = $1 order by created_at", [host.id]);
    expect(rows.map((r) => r.status)).toEqual(["cancelled", "confirmed"]);
    await page.goto(url);
    await expect(page.getByText("Cette réservation est annulée")).toBeVisible();
  });

  test("F03-E1 annulation dans deux onglets : une seule annulation, pas d'e-mails en double", async ({ context }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host);
    const first = await context.newPage();
    const { url, email: guestEmail } = await bookFirst(first, `/${username}/${et.slug}`);
    const second = await context.newPage();
    await second.goto(url);
    await Promise.all([
      first.getByRole("button", { name: "Annuler la réservation" }).click(),
      second.getByRole("button", { name: "Annuler la réservation" }).click(),
    ]);
    await expect(first.getByText("Cette réservation est annulée")).toBeVisible();
    await expect(second.getByText("Cette réservation est annulée")).toBeVisible();
    expect(await waitForMail("to_address = $1 and subject like 'Rendez-vous annulé%'", [guestEmail], 1)).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 1200));
    expect(await sql("select 1 from email_outbox where to_address = $1 and subject like 'Réservation annulée%'", [email])).toHaveLength(1);
  });

  test("F03-E2 jeton invalide ou tronqué : 404", async ({ page }) => {
    expect((await page.goto("/booking/n-importe-quoi"))!.status()).toBe(404);
    expect((await page.goto("/booking/n-importe-quoi/ics"))!.status()).toBe(404);
  });

  test("F03-E3 réservation annulée : plus de formulaire, proposition de réserver à nouveau", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    await bookFirst(page, `/${username}/${et.slug}`);
    await page.getByRole("button", { name: "Annuler la réservation" }).click();
    await expect(page.getByText("Cette réservation est annulée")).toBeVisible();
    await page.getByRole("link", { name: "Réserver un nouveau créneau" }).click();
    await expect(page).toHaveURL(new RegExp(`/${username}/${et.slug}$`));
  });

  test("F03-E4 jeton d'un autre hôte dans ?reschedule= : ignoré, réservation normale", async ({ page, browser }) => {
    const a = await makeHost(), b = await makeHost();
    const etA = await makeType(a.host), etB = await makeType(b.host);
    const bookingA = await bookDirect(a.host, etA, 0, "victime@example.test");
    await page.goto(`/${b.username}/${etB.slug}?reschedule=${bookingA.manageToken}`);
    await page.getByLabel("Votre fuseau horaire").waitFor();
    await expect(page.getByText("Vous choisissez un nouveau créneau")).toHaveCount(0);
    await expect(page.getByLabel("Nom", { exact: true })).toHaveCount(0);
    await pickSlot(page);
    await page.getByLabel("Nom", { exact: true }).fill("Attaquant");
    await page.getByLabel("Adresse e-mail").fill("victime@example.test");
    await confirmBtn(page).click();
    await page.waitForURL("**/booking/**");
    const [row] = await sql<{ status: string }>("select status from bookings where id = $1", [bookingA.id]);
    expect(row.status, "la réservation d'un autre hôte ne doit pas être touchée").toBe("confirmed");
    void browser;
  });

  test("F03-E5 fichier d'agenda (.ics) : valide, échappé, 404 une fois annulé", async ({ page, request }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host, { name: "Atelier; virgule, et antislash \\", locationDetail: "Salle 3, étage 2" });
    const { url } = await bookFirst(page, `/${username}/${et.slug}`);
    const res = await request.get(`${url}/ics`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(body).toContain("SUMMARY:Atelier\; virgule\\, et antislash \\\\");
    expect(body).toContain("LOCATION:Salle 3\\, étage 2");
    for (const line of body.split("\r\n")) expect(Buffer.byteLength(line), `ligne trop longue pour RFC 5545 : ${line.slice(0, 40)}…`).toBeLessThanOrEqual(75);
    await page.getByRole("button", { name: "Annuler la réservation" }).click();
    await expect(page.getByText("Cette réservation est annulée")).toBeVisible();
    expect((await request.get(`${url}/ics`)).status()).toBe(404);
  });

  test("F03-E6 motif hostile : affiché tel quel côté hôte, limité à 500 caractères", async ({ page, browser }) => {
    const { host, email, username } = await makeHost();
    const et = await makeType(host);
    await bookFirst(page, `/${username}/${et.slug}`);
    const evil = `<b onmouseover="window.__pwn=1">gras</b>`;
    await page.getByLabel("Motif").fill(evil + "x".repeat(600));
    await page.getByRole("button", { name: "Annuler la réservation" }).click();
    await expect(page.getByText("Cette réservation est annulée")).toBeVisible();
    const [row] = await sql<{ cancel_reason: string }>("select cancel_reason from bookings where host_id = $1", [host.id]);
    expect(row.cancel_reason.length).toBeLessThanOrEqual(500);
    const h = await (await newContext(browser)).newPage();
    await login(h, email);
    await h.goto("/bookings?vue=annulees");
    await expect(h.getByText(evil, { exact: false })).toBeVisible();
    expect(await h.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)).toBeUndefined();
  });

  test("F03-E7 réservation passée : plus d'actions d'annulation ni de replanification", async ({ page }) => {
    const { host } = await makeHost();
    const et = await makeType(host);
    const [r] = await sql<{ manage_token: string }>(
      `insert into bookings (event_type_id, host_id, start_at, end_at, guest_name, guest_email, guest_timezone)
       values ($1, $2, now() - interval '3 days', now() - interval '3 days' + interval '30 minutes', 'Passé', 'passe@example.test', 'UTC') returning manage_token`, [et.id, host.id]);
    await page.goto(`/booking/${r.manage_token}`);
    await expect(page.getByRole("heading", { name: et.name })).toBeVisible();
    await expect(page.getByRole("button", { name: "Annuler la réservation" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Choisir un autre créneau" })).toHaveCount(0);
  });

  test("F03-E8 annulation tardive : un lien d'annulation tronqué ou rejoué ne plante pas", async ({ page, request }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    const { url } = await bookFirst(page, `/${username}/${et.slug}`);
    const token = url.split("/").pop()!;
    expect((await request.get(`/booking/${token.slice(0, -3)}`)).status()).toBe(404);
    expect((await request.get(`/booking/${token}%00`)).status()).toBeLessThan(500);
  });

  test("F03-A accessibilité : page de gestion avant et après annulation", async ({ page }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    await bookFirst(page, `/${username}/${et.slug}`);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Annuler la réservation" }).click();
    await expect(page.getByText("Cette réservation est annulée")).toBeVisible();
    await expectAccessible(page);
  });
});
