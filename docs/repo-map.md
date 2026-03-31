# Repository Map

## Root

- `package.json`: root automation for installs, linting, Playwright, and local verification.
- `Cargo.toml`: Rust workspace for the desktop shell and shared crates.
- `playwright.config.ts`: browser-preview review harness.
- `.cache/`: local tool and test caches that should not leak into tracked project structure.
- `scripts/`: repo-level automation that avoids global tooling.
- `scripts/lib/`: shared helpers for repo-managed command execution.
- `.github/workflows/ci.yml`: CI for browser review and Windows Rust validation.

## App shell

- `apps/desktop/`: React frontend and Tauri desktop shell.
- `apps/desktop/src/app/`: main desktop shell composition.
- `apps/desktop/src/components/`: reusable UI primitives.
- `apps/desktop/src/features/`: product-surface feature modules such as windows, effects, settings, and support.
- `apps/desktop/src/lib/`: browser-preview bridge, localization, and theme helpers.
- `apps/desktop/src/styles/`: split CSS modules for shell, controls, panels, and responsive rules.
- `apps/desktop/src-tauri/`: Tauri entry point, tray shell, logging, state management, and lens backend modules.
- `apps/desktop/src-tauri/src/lens/`: platform-specific lens controller modules.

## Shared Rust crates

- `crates/glare-mute-core/`: shared domain contracts such as settings, presets, capabilities, and diagnostics snapshots.
- `crates/glare-mute-platform/`: platform capability probing and Windows-vs-preview runtime descriptions.

## Documentation

- `docs/architecture/`: durable architectural guidance.
- `docs/adr/`: explicit decisions and tradeoffs.
- `docs/contributing/`: contributor workflows.
- `docs/operations/`: runtime debugging and operational notes.
