import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { newContext } from "./helpers.ts";

/**
 * `test` enrichi : chaque test échoue sur une erreur JavaScript de page, une erreur de console
 * (hors 4xx attendus dans les cas négatifs) ou une réponse 5xx, et reçoit un contexte isolé (IP et fuseau propres).
 */
export const test = base.extend<{ guard: void }>({
  context: async ({ browser }, use) => {
    const c = await newContext(browser);
    await use(c);
    await c.close();
  },
  guard: [async ({ context }, use) => {
    const problems: string[] = [];
    const watch = (p: import("@playwright/test").Page) => {
      p.on("pageerror", (e) => problems.push(`erreur de page : ${e.message}`));
      p.on("console", (m) => { if (m.type() === "error" && !/status of 4\d\d|ERR_INTERNET_DISCONNECTED/.test(m.text())) problems.push(`console : ${m.text()}`); });
      p.on("response", (r) => { if (r.status() >= 500) problems.push(`HTTP ${r.status()} sur ${r.url()}`); });
    };
    context.on("page", watch);
    context.pages().forEach(watch);
    await use();
    expect(problems, "erreurs détectées pendant le test").toEqual([]);
  }, { auto: true }],
});

export { expect };

/** Analyse d'accessibilité (axe) : zéro violation attendue, avec le détail en cas d'échec. */
export async function expectAccessible(page: import("@playwright/test").Page) {
  // Pendant une navigation, Next remplace le <title> : on attend qu'il soit posé. S'il ne l'est jamais, l'attente échoue (vrai défaut).
  await page.waitForFunction(() => document.title.trim().length > 0, undefined, { timeout: 5000 });
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const where = `${new URL(page.url()).pathname} « ${await page.title()} »`;
  const summary = res.violations.map((v) => `[${where}] ${v.id} (${v.impact}) : ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, "violations d'accessibilité").toEqual([]);
}
