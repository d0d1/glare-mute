import path from "node:path";
import { fileURLToPath } from "node:url";

import { spawnPackageManagerSync } from "./lib/package-manager.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const execution = spawnPackageManagerSync(repoRoot, process.argv.slice(2), {
  stdio: "inherit",
});

process.exit(execution.status ?? 1);
