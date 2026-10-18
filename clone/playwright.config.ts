import { defineConfig } from "@playwright/test";

// Base dédiée aux tests de bout en bout : vidée au démarrage (global-setup). Ne jamais la pointer vers une vraie base.
const DB = process.env.E2E_DATABASE_URL ?? "";
if (!DB) throw new Error("E2E_DATABASE_URL manquant (base dédiée, migrée, jetable)");
process.env.DATABASE_URL = DB; // lue aussi par les aides de test qui importent lib/*
process.env.EMAIL_TRANSPORT = "outbox";
process.env.APP_URL = "http://localhost:3100";
process.env.CRON_SECRET = "secret-e2e-0123456789abcdef";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1, // une seule base partagée
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["json", { outputFile: "e2e-results.json" }]],
  use: {
    baseURL: "http://localhost:3100",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: "node_modules/.bin/next start -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DATABASE_URL: DB, EMAIL_TRANSPORT: "outbox", APP_URL: "http://localhost:3100", CRON_SECRET: process.env.CRON_SECRET! },
  },
});
