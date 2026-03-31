import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

export function getPinnedPackageManager(repoRoot) {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const packageManager = packageJson.packageManager ?? "pnpm";
  const [name] = packageManager.split("@");
  return name;
}

export function spawnPackageManagerSync(repoRoot, args, options = {}) {
  const packageManager = getPinnedPackageManager(repoRoot);
  const attempts = [
    {
      command: process.platform === "win32" ? "corepack.cmd" : "corepack",
      args: [packageManager, ...args],
    },
    {
      command: packageManager,
      args,
    },
  ];

  for (const attempt of attempts) {
    const execution = spawnSync(attempt.command, attempt.args, {
      cwd: repoRoot,
      encoding: "utf8",
      ...options,
    });

    if (execution.error?.code === "ENOENT") {
      continue;
    }

    return execution;
  }

  throw new Error(`Could not find corepack or ${packageManager} on PATH.`);
}
