import { spawnSync } from "node:child_process";

const topics = [
  "accessibility",
  "windows",
  "tauri",
  "rust",
  "react",
  "photophobia",
  "desktop-app",
  "assistive-technology",
  "open-source",
  "dark-mode",
];

const args = [
  "api",
  "--method",
  "PUT",
  "repos/d0d1/glare-mute/topics",
  "-H",
  "Accept: application/vnd.github+json",
  ...topics.flatMap((topic) => ["-f", `names[]=${topic}`]),
];

const ghCheck = spawnSync("gh", ["--version"], {
  cwd: process.cwd(),
  encoding: "utf8",
});

if (ghCheck.error?.code === "ENOENT") {
  console.error(
    "GitHub CLI is required for scripts/sync-topics.mjs. Install `gh` and authenticate before running this repo-maintenance script."
  );
  process.exit(1);
}

const execution = spawnSync("gh", args, {
  cwd: process.cwd(),
  stdio: "inherit",
});

if (execution.status !== 0) {
  process.exit(execution.status ?? 1);
}
