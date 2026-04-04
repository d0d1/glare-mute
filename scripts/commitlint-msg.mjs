import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";

const cliEntry = await realpath(new URL("../node_modules/@commitlint/cli/cli.js", import.meta.url));
const requireFromCli = createRequire(cliEntry);
const lint = requireFromCli("@commitlint/lint").default;
const conventionalConfig = requireFromCli("@commitlint/config-conventional").default;

const filePath = process.argv[2];

if (!filePath) {
  console.error("commitlint hook requires a commit message file path.");
  process.exit(1);
}

const rawMessage = await readFile(filePath, "utf8");
const message = rawMessage.replace(/\r\n/g, "\n").trimEnd();

const report = await lint(message, conventionalConfig.rules, {
  defaultIgnores: true,
  parserOpts: conventionalConfig.parserPreset?.parserOpts,
});

if (report.valid) {
  process.exit(0);
}

console.error(`⧗   input: ${message}`);
for (const error of report.errors) {
  console.error(`✖   ${error.message} [${error.name}]`);
}
console.error("");
console.error("✖   found %d problems, 0 warnings", report.errors.length);
console.error(
  "ⓘ   Get help: https://github.com/conventional-changelog/commitlint/#what-is-commitlint"
);
process.exit(1);
