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

const execution = spawnSync("gh", args, {
  cwd: process.cwd(),
  stdio: "inherit",
});

if (execution.status !== 0) {
  process.exit(execution.status ?? 1);
}
