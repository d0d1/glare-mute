import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [, , mode = "test", ...rest] = process.argv;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");

const args =
  mode === "install"
    ? ["exec", "playwright", "install", "chromium", ...rest]
    : ["exec", "playwright", mode, ...rest];

const execution = spawnSync("pnpm", args, {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: path.join(repoRoot, ".cache", "ms-playwright"),
  },
});

if (execution.status !== 0) {
  process.exit(execution.status ?? 1);
}
