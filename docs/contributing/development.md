# Development Workflow

## Preferred loops

### Fast UI loop

```bash
pnpm dev:web
```

Use this for frontend iteration, contract debugging, and Playwright review.

### Desktop loop

```bash
cmd.exe /c "cd /d C:\Users\dbhul\code\glare-mute && set TAURI_DEV_HOST=127.0.0.1 && cargo run -p glare-mute-desktop"
```

Use this when working on tray behavior, logging, settings persistence, or native integrations.

This direct `cargo run` path is intentional for this repo layout. It avoids Tauri CLI optional-binary issues when the workspace dependencies were installed from WSL but the desktop runtime needs to launch on Windows.

## Agent-first expectations

- do not rely on manual user testing for basic validation
- use the diagnostics panel and log surfaces before asking for help
- prefer reproducible commands over ad-hoc clicking
- keep the browser preview healthy because it is the fastest review surface
- document Windows-only launch and debug paths whenever they differ from the preview path

## Local dependency policy

- JavaScript tooling is installed locally through `pnpm`
- Playwright browsers live under `.cache/ms-playwright`
- Python tooling should go in `.venv` if added later
- avoid global installs unless a tool genuinely cannot be used locally
- the desktop package scripts call local `node_modules` entrypoints directly to avoid `.cmd` shim drift between WSL and Windows
