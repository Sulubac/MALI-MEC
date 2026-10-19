// Captures de contrôle visuel (non bloquantes) : contenus extrêmes à 390 px. Lancer : npx playwright test e2e/visual.spec.ts
import { test } from "./fixtures.ts";
import { bookDirect, login, makeHost, makeType, newContext, sql } from "./helpers.ts";

const OUT = process.env.SCREENS_DIR ?? "test-results/visual";

test("captures visuelles", async ({ browser }) => {
  const { host, email, username } = await makeHost();
  const et = await makeType(host, { name: "Un type au nom aussi long que possible " + "m".repeat(40), description: "Description avec une adresse https://exemple.fr/" + "a".repeat(80) });
  await sql(`insert into bookings (event_type_id, host_id, start_at, end_at, guest_name, guest_email, guest_timezone)
    values ($1,$2, now() + interval '2 days', now() + interval '2 days' + interval '30 minutes', $3, $4, 'UTC')`, [et.id, host.id, "Z".repeat(100), `${"y".repeat(50)}@example.test`]);
  const b = await bookDirect(host, et, 4, "court@example.test");
  const page = await (await newContext(browser, { width: 390, height: 844 })).newPage();
  await page.goto(`/${username}/${et.slug}`); await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/guest-booking-390.png`, fullPage: true });
  await page.goto(`/booking/${b.manageToken}`);
  await page.screenshot({ path: `${OUT}/guest-confirmation-390.png`, fullPage: true });
  await login(page, email);
  for (const [n, p] of [["event-types", "/event-types"], ["bookings", "/bookings"], ["availability", "/availability"]]) {
    await page.goto(p); await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/host-${n}-390.png`, fullPage: true });
  }
  const wide = await (await newContext(browser, { width: 1280, height: 800 })).newPage();
  await login(wide, email);
  await wide.goto("/bookings");
  await wide.screenshot({ path: `${OUT}/host-bookings-1280.png`, fullPage: true });
});
