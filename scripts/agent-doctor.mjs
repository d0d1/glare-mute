import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getPinnedPackageManager, spawnPackageManagerSync } from "./lib/package-manager.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const packageManager = getPinnedPackageManager(repoRoot);

const commands = [
  ["node", ["--version"]],
  ["rustc", ["--version"]],
  ["cargo", ["--version"]],
  ["python3", ["--version"]],
  ["git", ["status", "--short", "--branch"]],
];

const results = commands.map(([command, args]) => {
  const execution = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  return {
    command: [command, ...args].join(" "),
    status: execution.status,
    stdout: execution.stdout.trim(),
    stderr: execution.stderr.trim(),
  };
});

const packageManagerExecution = spawnPackageManagerSync(repoRoot, ["--version"]);
results.splice(1, 0, {
  command: `${packageManager} --version`,
  status: packageManagerExecution.status,
  stdout: packageManagerExecution.stdout.trim(),
  stderr: packageManagerExecution.stderr.trim(),
});

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      cwd: process.cwd(),
      results,
    },
    null,
    2
  )
);
