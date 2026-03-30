# GlareMute

GlareMute is an open-source Windows accessibility lens for bright legacy apps that ignore dark mode and contrast settings.

The first native test slice is intentionally narrow:

- enumerate visible top-level Windows app windows
- attach `Greyscale Invert` to one selected main window
- suspend or detach the lens quickly from the dashboard or tray

The repository is intentionally shaped for agent-driven development:

- `Tauri 2 + Rust + React/TypeScript`
- a browser-preview mode that shares the same desktop command contract
- first-class diagnostics in the UI and on disk
- Playwright review for visual work
- local installs only, with repo-managed tooling wherever possible

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
pnpm install
pnpm playwright:install
pnpm dev:web
```

For the Windows desktop shell from this repo layout:

```bash
cmd.exe /c "cd /d C:\Users\dbhul\code\glare-mute && set TAURI_DEV_HOST=127.0.0.1 && cargo run -p glare-mute-desktop"
```

That path avoids the Tauri CLI optional-binary issues that show up when the repo dependencies were installed from WSL.

## Verification

```bash
pnpm build:web
pnpm test:unit
pnpm test:e2e
cargo test -p glare-mute-core -p glare-mute-platform
cargo check -p glare-mute-desktop
```

## Documentation

- [Documentation index](./docs/README.md)
- [Repository map](./docs/repo-map.md)
- [Architecture overview](./docs/architecture/overview.md)
- [Debugging workflow](./docs/operations/debugging.md)
- [Development workflow](./docs/contributing/development.md)
- [Windows IRPF test flow](./docs/operations/windows-irpf-test.md)
