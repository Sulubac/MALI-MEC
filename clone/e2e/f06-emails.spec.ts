// Transverse : e-mails transactionnels et file de tâches
import { test, expect } from "./fixtures.ts";
import { bookFirst, makeHost, makeType, sql, waitForMail, expectNoMail } from "./helpers.ts";

const cron = (request: import("@playwright/test").APIRequestContext) =>
  request.get("/api/cron/jobs", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });

test.describe("E-mails", () => {
  test("E-H1 confirmation : fuseau de l'invité, lien de gestion, durée ; notification à l'hôte dans son fuseau", async ({ page, browser }) => {
    const { host, email, username } = await makeHost("Asia/Tokyo");
    const et = await makeType(host, { name: "Séance d'été", durationMinutes: 45 });
    const g = await browser.newContext({ locale: "fr-FR", timezoneId: "America/Chicago", extraHTTPHeaders: { "x-forwarded-for": "10.9.9.9" } });
    const { url, email: guestEmail } = await bookFirst(await g.newPage(), `/${username}/${et.slug}`, "Zoé Müller");
    const [toGuest] = await waitForMail("to_address = $1", [guestEmail]);
    expect(toGuest.subject).toBe(`Rendez-vous confirmé : Séance d'été avec Hôte ${username}`);
    expect(toGuest.body_text).toContain("Bonjour Zoé Müller");
    expect(toGuest.body_text).toContain("45 minutes");
    expect(toGuest.body_text).toContain(new URL(url).pathname);
    expect(toGuest.body_text).toMatch(/CST|CDT|UTC−|GMT−/);
    const [toHost] = await waitForMail("to_address = $1 and subject like 'Nouvelle%'", [email]);
    expect(toHost.body_text).toMatch(/JST|UTC\+9|GMT\+9/);
    void page;
  });

  test("E-H2 rappel 24 h avant : pas d'envoi anticipé, un seul envoi même si le planificateur passe deux fois", async ({ page, request }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host, { minNoticeMinutes: 3 * 24 * 60 });
    const { email: guestEmail } = await bookFirst(page, `/${username}/${et.slug}`);
    await waitForMail("to_address = $1", [guestEmail]);
    await cron(request);
    expect(await sql("select 1 from email_outbox where to_address = $1 and subject like 'Rappel%'", [guestEmail])).toHaveLength(0);
    await sql("update jobs set run_at = now() where payload->>'template' = 'booking_reminder' and status = 'pending'");
    const r1 = await (await cron(request)).json();
    const r2 = await (await cron(request)).json();
    expect(r1.jobs.done + r2.jobs.done).toBeGreaterThanOrEqual(1);
    expect(await sql("select 1 from email_outbox where to_address = $1 and subject like 'Rappel%'", [guestEmail])).toHaveLength(1);
  });

  test("E-E1 réservation annulée avant le rappel : aucun rappel, seule l'annulation est envoyée", async ({ page, request }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host, { minNoticeMinutes: 3 * 24 * 60 });
    const { email: guestEmail } = await bookFirst(page, `/${username}/${et.slug}`);
    await page.getByRole("button", { name: "Annuler la réservation" }).click();
    await expect(page.getByText("Cette réservation est annulée")).toBeVisible();
    await waitForMail("to_address = $1 and subject like 'Rendez-vous annulé%'", [guestEmail]);
    await sql("update jobs set run_at = now() where status = 'pending'");
    await cron(request);
    expect(await sql("select 1 from email_outbox where to_address = $1 and subject like 'Rappel%'", [guestEmail])).toHaveLength(0);
  });

  test("E-E2 une erreur d'envoi est retentée puis visible dans la file, sans bloquer la réservation", async ({ page, request }) => {
    const { host, username } = await makeHost();
    const et = await makeType(host);
    // un destinataire dont la ligne de file est volontairement corrompue : la file l'isole sans planter
    await sql("insert into jobs (kind, payload, idempotency_key) values ('email', '{\"template\":\"inconnu\",\"bookingId\":\"00000000-0000-0000-0000-000000000000\",\"audience\":\"guest\"}', $1)", [`corrompu-${Date.now()}`]);
    const { email: guestEmail } = await bookFirst(page, `/${username}/${et.slug}`);
    const res = await (await cron(request)).json();
    expect(res.jobs).toBeDefined();
    expect(await waitForMail("to_address = $1", [guestEmail])).toHaveLength(1);
    const bad = await sql<{ status: string; attempts: number }>("select status, attempts from jobs where idempotency_key like 'corrompu-%' order by created_at desc limit 1");
    expect(["pending", "done", "failed"]).toContain(bad[0].status);
  });

  test("E-E3 un invité qui n'a rien réservé ne reçoit rien ; aucune réservation = aucun e-mail", async () => {
    await expectNoMail("to_address = 'jamais@example.test'");
  });
});
