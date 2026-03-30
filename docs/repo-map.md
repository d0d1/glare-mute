# Repository Map

## Root

- `package.json`: root automation for installs, linting, Playwright, and agent diagnostics.
- `Cargo.toml`: Rust workspace for the desktop shell and shared crates.
- `playwright.config.ts`: browser-preview review harness.
- `scripts/`: repo-level automation that avoids global tooling.
- `.github/workflows/ci.yml`: CI for browser review and Windows Rust validation.

## App shell

- `apps/desktop/`: React frontend and Tauri desktop shell.
- `apps/desktop/src/`: UI, browser-preview bridge, and test helpers.
- `apps/desktop/src-tauri/`: Tauri entry point, tray shell, logging, and state management.

## Shared Rust crates

- `crates/glare-mute-core/`: shared domain contracts such as settings, presets, capabilities, and diagnostics snapshots.
- `crates/glare-mute-platform/`: platform capability probing and Windows-vs-preview runtime descriptions.

## Documentation

- `docs/architecture/`: durable architectural guidance.
- `docs/adr/`: explicit decisions and tradeoffs.
- `docs/contributing/`: contributor workflows.
- `docs/operations/`: runtime debugging and operational notes.
