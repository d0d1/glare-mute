# Conventional Commits

This repository uses Conventional Commits 1.0.0.

## Required shape

```text
type(scope?): subject
```

Examples:

- `feat(shell): add tray-based effect controls`
- `fix(theme): persist system preference correctly`
- `docs(debugging): document log file locations`

## Enforcement

- `commitlint` is configured at the repo root
- `.husky/commit-msg` runs commitlint locally
- CI should reject drift from the same convention
