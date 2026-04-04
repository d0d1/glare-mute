import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";

const cliEntry = await realpath(new URL("../node_modules/@commitlint/cli/cli.js", import.meta.url));
const requireFromCli = createRequire(cliEntry);
const format = requireFromCli("@commitlint/format").default;
const lint = requireFromCli("@commitlint/lint").default;
const load = requireFromCli("@commitlint/load").default;

const filePath = process.argv[2];

if (!filePath) {
  console.error("commitlint hook requires a commit message file path.");
  process.exit(1);
}

const rawMessage = await readFile(filePath, "utf8");
const message = rawMessage.replace(/\r\n/g, "\n").trimEnd();

const loaded = await load(
  {},
  {
    cwd: process.cwd(),
  }
);

const report = await lint(message, loaded.rules, {
  defaultIgnores: loaded.defaultIgnores,
  helpUrl: loaded.helpUrl,
  ignores: loaded.ignores,
  parserOpts: loaded.parserPreset?.parserOpts,
});

if (report.valid) {
  process.exit(0);
}

process.stderr.write(
  format(
    {
      results: [report],
    },
    {
      color: true,
      helpUrl: loaded.helpUrl,
    }
  )
);
process.exit(1);
