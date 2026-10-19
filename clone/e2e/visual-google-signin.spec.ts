// Captures de l'écran S01 avec Google (non bloquantes). Lancer : SCREENS_DIR=… npx playwright test e2e/visual-google-signin.spec.ts
import { randomUUID } from "node:crypto";
import { test } from "./fixtures.ts";
import { makeHost, newContext } from "./helpers.ts";

const OUT = process.env.SCREENS_DIR ?? "test-results/visual";
const G = "http://127.0.0.1:3199";
const control = (path: string, body: unknown = {}) => fetch(`${G}/__control/${path}`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());

test("captures S01 Google", async ({ browser }) => {
  for (const [tag, w, h] of [["1440", 1440, 900], ["390", 390, 844]] as const) {
    await control("reset");
    const page = await (await newContext(browser, { width: w, height: h })).newPage();
    await page.goto("/login");
    await page.screenshot({ path: `${OUT}/S01-login-google-${tag}.png`, fullPage: true });
    const host = await makeHost();
    await control("options", { loginEmail: host.email });
    await page.getByRole("button", { name: "Continuer avec Google" }).click(); // compte local vérifié : message « existe déjà »
    await page.getByText(/Un compte existe déjà/).waitFor();
    await page.screenshot({ path: `${OUT}/S01-login-exists-${tag}.png`, fullPage: true });
    await control("options", { loginEmail: `${randomUUID().slice(0, 8)}.martin@gmail.test`, loginName: "Alex Martin" });
    await page.getByRole("button", { name: "Continuer avec Google" }).click();
    await page.waitForURL("**/signup/google");
    await page.screenshot({ path: `${OUT}/S01-complete-${tag}.png`, fullPage: true });
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL("**/event-types");
    await page.goto("/account");
    await page.screenshot({ path: `${OUT}/S01-account-google-${tag}.png`, fullPage: true });
  }
});
