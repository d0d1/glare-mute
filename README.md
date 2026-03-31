# Glare mute

Glare mute is an open-source Windows accessibility lens for bright legacy apps that ignore dark mode and contrast settings.

The first native test slice is intentionally narrow:

- keep a live, stable list of top-level Windows app windows, including minimized ones
- apply either `Invert` or `Greyscale Invert` to a selected app window and related windows when possible
- turn off the effect quickly from the app window or tray

The repository is intentionally shaped for fast Windows iteration and repeatable local verification:

- `Tauri 2 + Rust + React/TypeScript`
- a browser-preview mode that shares the same desktop command contract
- first-class diagnostics in dev builds and on disk
- screenshot-backed browser review against a deterministic preview server
- local installs only, with repo-managed tooling wherever possible
- package-manager cache kept under `.cache/pnpm`
- icon generation scripted through a repo-local Python venv under `.cache`

## Project rules

- Windows-only v1
- tray-first UX
- accessibility lens, not theme injection
- tint backend plus transform backend
- GPL-3.0-only
- Conventional Commits 1.0.0

## Quick start

For the browser preview:

```bash
corepack pnpm install
corepack pnpm playwright:install
corepack pnpm dev:web
```

This serves the live iteration surface on `http://127.0.0.1:1420`.

When this repo is shared between WSL and Windows, install dependencies once after pulling changes so the workspace picks up both the current Linux tooling and the Windows-native Tauri CLI binding:

```bash
corepack pnpm install
```

For the Windows desktop shell from this repo layout:

```bash
cmd.exe /c "cd /d C:\Users\dbhul\code\glare-mute && set TAURI_DEV_HOST=127.0.0.1 && cargo run -p glare-mute-desktop"
```

That direct path still works, but the workspace is also configured to install the Windows-native Tauri CLI binding so `tauri:build` and other Windows CLI flows can run from the same shared repo after a normal install.

To regenerate the app and tray icon assets:

```bash
python3 -m venv .cache/python/icon-tools
.cache/python/icon-tools/bin/pip install pillow
.cache/python/icon-tools/bin/python scripts/generate_icons.py
```

## Verification

```bash
corepack pnpm build:web
corepack pnpm test:unit
corepack pnpm test:e2e
cargo test -p glare-mute-core -p glare-mute-platform
cargo check -p glare-mute-desktop
```

`corepack pnpm test:e2e` builds the web app and runs Playwright against a separate preview server on `http://127.0.0.1:1421`, so screenshot review does not depend on a dev server already running.

## Documentation

- [Documentation index](./docs/README.md)
- [Repository map](./docs/repo-map.md)
- [Architecture overview](./docs/architecture/overview.md)
- [Debugging workflow](./docs/operations/debugging.md)
- [Development workflow](./docs/contributing/development.md)
- [Release workflow](./docs/contributing/releasing.md)
- [Windows IRPF test flow](./docs/operations/windows-irpf-test.md)
