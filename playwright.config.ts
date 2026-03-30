import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://127.0.0.1:1420",
    trace: "on-first-retry",
    viewport: { width: 1440, height: 1080 },
  },
  webServer: {
    command: "pnpm --filter @glaremute/desktop dev:web",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120000,
  },
});
