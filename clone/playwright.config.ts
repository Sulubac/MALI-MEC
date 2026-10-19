import { defineConfig } from "@playwright/test";

// Base dédiée aux tests de bout en bout : vidée au démarrage (global-setup). Ne jamais la pointer vers une vraie base.
const DB = process.env.E2E_DATABASE_URL ?? "";
if (!DB) throw new Error("E2E_DATABASE_URL manquant (base dédiée, migrée, jetable)");
process.env.DATABASE_URL = DB; // lue aussi par les aides de test qui importent lib/*
process.env.EMAIL_TRANSPORT = "outbox";
process.env.APP_URL = "http://localhost:3100";
process.env.CRON_SECRET = "secret-e2e-0123456789abcdef";
// Faux Google (e2e/fake-google.ts) : l'application et les aides de test parlent à lui, jamais au vrai Google.
const FAKE_GOOGLE = "http://127.0.0.1:3199";
const GOOGLE_ENV = {
  GOOGLE_CLIENT_ID: "client-test.apps.example", GOOGLE_CLIENT_SECRET: "secret-test", TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64"),
  GOOGLE_AUTH_URL: `${FAKE_GOOGLE}/auth`, GOOGLE_TOKEN_URL: `${FAKE_GOOGLE}/token`, GOOGLE_REVOKE_URL: `${FAKE_GOOGLE}/revoke`, GOOGLE_API_BASE: `${FAKE_GOOGLE}/calendar/v3`,
};
Object.assign(process.env, GOOGLE_ENV);

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
  webServer: [
    {
      command: "node_modules/.bin/next start -p 3100",
      url: "http://localhost:3100/login",
      reuseExistingServer: false,
      timeout: 60_000,
      env: { DATABASE_URL: DB, EMAIL_TRANSPORT: "outbox", APP_URL: "http://localhost:3100", CRON_SECRET: process.env.CRON_SECRET!, ...GOOGLE_ENV },
    },
    {
      command: "node --experimental-strip-types --no-warnings e2e/fake-google-main.ts",
      port: 3199,
      reuseExistingServer: false,
      timeout: 20_000,
      env: { FAKE_GOOGLE_PORT: "3199" },
    },
  ],
});
