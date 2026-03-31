# Architecture Overview

Glare mute is built as a Windows-focused desktop shell with a browser-preview mode.

That split is deliberate:

- the desktop shell needs native tray, window, path, and logging integrations
- the UI needs fast iteration and automated visual review
- agents need a way to exercise the interface without depending on a native desktop runtime for every change

## Major layers

### Desktop shell

`apps/desktop/src-tauri/` owns:

- the tray application lifecycle
- structured logging
- settings persistence
- capability probing
- command handlers exposed to the frontend

### Shared domain contracts

`crates/glare-mute-core/` defines:

- theme preference
- preset catalog
- profile rules
- capability descriptors
- diagnostics snapshots

These types are the stable interface between the frontend and the backend.

### Platform capability layer

`crates/glare-mute-platform/` answers:

- what runtime is this
- what capability set is exposed here
- which effect backends are available, experimental, planned, or unsupported

### Frontend shell

`apps/desktop/src/` renders:

- the current session state
- theme controls
- action surfaces
- diagnostics and paths

The frontend talks to the backend through `desktopClient`. In Tauri it uses real commands. In browser preview it uses a mock runtime that persists to `localStorage`.
