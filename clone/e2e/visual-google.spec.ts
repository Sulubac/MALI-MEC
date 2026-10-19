// Captures de l'écran S02 (non bloquantes). Lancer : SCREENS_DIR=… npx playwright test e2e/visual-google.spec.ts
import { test } from "./fixtures.ts";
import { login, makeHost, makeType, newContext } from "./helpers.ts";

const OUT = process.env.SCREENS_DIR ?? "test-results/visual";
const G = "http://127.0.0.1:3199";
const control = (path: string, body: unknown = {}) => fetch(`${G}/__control/${path}`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());

test("captures S02", async ({ browser }) => {
  for (const [tag, w, hgt] of [["1440", 1440, 900], ["390", 390, 844]] as const) {
    await control("reset");
    const h = await makeHost(); // un hôte neuf par taille d'écran : sinon le second est déjà connecté
    const et = await makeType(h.host);
    const page = await (await newContext(browser, { width: w, height: hgt })).newPage();
    await login(page, h.email);
    await page.goto("/integrations");
    await page.screenshot({ path: `${OUT}/S02-not-connected-${tag}.png`, fullPage: true });
    await page.getByRole("button", { name: "Connecter Google Agenda" }).click();
    await page.getByText("Google Agenda est connecté.").waitFor();
    await page.screenshot({ path: `${OUT}/S02-connected-${tag}.png`, fullPage: true });
    if (tag === "1440") {
      await control("revoke-all", { email: "host@gmail.test" });
      const g = await (await newContext(browser)).newPage();
      await g.goto(`/${h.username}/${et.slug}`);
      await g.getByLabel("Votre fuseau horaire").waitFor();
      await page.goto("/integrations");
      await page.getByRole("heading", { name: "Google Agenda : reconnexion nécessaire" }).waitFor();
      await page.screenshot({ path: `${OUT}/S02-reconnect-${tag}.png`, fullPage: true });
      await page.getByRole("button", { name: "Reconnecter Google Agenda" }).click();
      await page.getByText("Google Agenda est connecté.").waitFor();
    } else {
      await page.getByRole("button", { name: "Déconnecter Google Agenda" }).click();
      await page.getByRole("button", { name: "Confirmer la déconnexion" }).click();
      await page.getByText("Google Agenda est déconnecté.").waitFor();
      await page.screenshot({ path: `${OUT}/S02-disconnected-${tag}.png`, fullPage: true });
    }
  }
});
