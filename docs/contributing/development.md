# Development Workflow

## Preferred loops

### Fast UI loop

```bash
pnpm dev:web
```

Use this for frontend iteration, contract debugging, and Playwright review.

This live iteration server stays on `http://127.0.0.1:1420`.
Playwright screenshot review uses a separate production-preview server on `127.0.0.1:1421` so visual tests do not depend on the dev server state.

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
- Python tooling should go in a repo-local venv
- icon generation uses `.venv-icons` plus `scripts/generate_icons.py`
- avoid global installs unless a tool genuinely cannot be used locally
- the desktop package scripts call local `node_modules` entrypoints directly to avoid `.cmd` shim drift between WSL and Windows

## Icon workflow

Regenerate the app and tray icons from the scripted source when the product mark changes:

```bash
python3 -m venv .venv-icons
.venv-icons/bin/pip install pillow
.venv-icons/bin/python scripts/generate_icons.py
```

This updates the Tauri bundle assets under `apps/desktop/src-tauri/icons`.
