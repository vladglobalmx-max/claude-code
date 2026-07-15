import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    // Next 16's allowedDevOrigins defaults to "localhost" only — hitting the
    // dev server from 127.0.0.1 silently breaks client hydration (blocked
    // cross-origin dev asset requests), so tests must use "localhost".
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
    },
  },
});
