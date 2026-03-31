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

This direct `cargo run` path is still a valid loop, but the workspace install is configured to fetch the Windows-native Tauri CLI binding too, so Windows `tauri:dev` and `tauri:build` can run from the same shared repo after a normal install.

If you have just pulled changes or the repo was previously installed only from WSL, refresh the shared install once:

```bash
npm exec --yes pnpm@10.32.1 -- install
```

## Development expectations

- do not rely on manual user testing for basic validation when local checks can cover it
- use the diagnostics panel and log surfaces before asking for extra help
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
