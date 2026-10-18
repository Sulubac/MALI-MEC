import { randomUUID } from "node:crypto";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { query } from "../lib/db.ts";
import { signUp, verifyEmail } from "../lib/auth-core.ts";
import { createBooking, createEventType, getHostByUsername, listSlots } from "../lib/store.ts";
import type { EventType, EventTypeInput, Host } from "../lib/types.ts";

export const PASSWORD = "un-mot-de-passe-solide-1";
export const DEMO = { email: "demo@example.test", password: "demo-demo-demo-1", username: "demo" };

export const sql = query;

export const typeDefaults: EventTypeInput = {
  name: "Rendez-vous test", description: "", durationMinutes: 30, locationKind: "video", locationDetail: "",
  minNoticeMinutes: 0, maxDaysAhead: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, limitPerDay: null, limitPerWeek: null,
  questions: [], confirmationRedirectUrl: "",
};

/** Hôte vérifié, créé directement en base (plus rapide que le parcours d'inscription, qui a ses propres tests). */
export async function makeHost(tz = "Europe/Paris"): Promise<{ host: Host; email: string; username: string }> {
  const username = `h${randomUUID().slice(0, 8)}`;
  const email = `${username}@example.test`;
  const r = await signUp({ email, password: PASSWORD, username, displayName: `Hôte ${username}`, timezone: tz });
  if (r.status !== "created") throw new Error("inscription : " + r.status);
  await verifyEmail(r.token);
  return { host: (await getHostByUsername(username))!, email, username };
}

export async function makeType(host: Host, over: Partial<EventTypeInput> = {}): Promise<EventType> {
  return createEventType(host.id, { ...typeDefaults, ...over });
}

export async function bookDirect(host: Host, et: EventType, i = 0, guestEmail = `g${randomUUID().slice(0, 6)}@example.test`) {
  const slot = (await listSlots(host, et))[i];
  return createBooking(host, et, { startAt: slot, guestName: "Invité direct", guestEmail, guestTimezone: "Europe/Paris" });
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("**/event-types");
}

/** Contexte isolé : fuseau et adresse IP propres (les limites de débit sont par IP). */
export async function newContext(browser: Browser, opts: { tz?: string; width?: number; height?: number } = {}): Promise<BrowserContext> {
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  return browser.newContext({
    locale: "fr-FR", timezoneId: opts.tz ?? "Europe/Paris",
    viewport: { width: opts.width ?? 1280, height: opts.height ?? 800 },
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
}

/** Choisit le premier jour libre et le premier créneau (ou celui d'indice `slot`). */
export async function pickSlot(page: Page, slot = 0) {
  await page.locator("section[aria-label='Choisir une date'] button[aria-pressed]:not([disabled])").first().click();
  await page.locator("section[aria-label^='Créneaux'] ul button").nth(slot).click();
}

export async function fillGuest(page: Page, name = "Camille Durand", email = "camille@example.test") {
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Adresse e-mail").fill(email);
}

export async function bookFirst(page: Page, path: string, name = "Camille Durand", email = `c${randomUUID().slice(0, 6)}@example.test`) {
  await page.goto(path);
  await page.getByLabel("Votre fuseau horaire").waitFor();
  await pickSlot(page);
  await fillGuest(page, name, email);
  await page.getByRole("button", { name: /^Confirmer/ }).click();
  await page.waitForURL("**/booking/**");
  return { url: page.url(), email };
}

export async function waitForMail(where: string, params: unknown[] = [], n = 1, ms = 10_000) {
  const t0 = Date.now();
  for (;;) {
    const rows = await query<{ to_address: string; subject: string; body_text: string }>(
      `select to_address, subject, body_text from email_outbox where ${where} order by created_at`, params);
    if (rows.length >= n || Date.now() - t0 > ms) return rows;
    await new Promise((r) => setTimeout(r, 150));
  }
}

export async function expectNoMail(where: string, params: unknown[] = [], wait = 1200) {
  await new Promise((r) => setTimeout(r, wait));
  const rows = await query(`select 1 from email_outbox where ${where}`, params);
  expect(rows).toHaveLength(0);
}
