import { spawnSync } from "node:child_process";

const [, , mode = "test"] = process.argv;
const args =
  mode === "install"
    ? ["exec", "playwright", "install", "chromium"]
    : ["exec", "playwright", "test"];

const execution = spawnSync("pnpm", args, {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: ".cache/ms-playwright",
  },
});

if (execution.status !== 0) {
  process.exit(execution.status ?? 1);
}
