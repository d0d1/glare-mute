import { spawnSync } from "node:child_process";

const commands = [
  ["node", ["--version"]],
  ["pnpm", ["--version"]],
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
