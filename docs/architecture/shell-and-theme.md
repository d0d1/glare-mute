# Desktop Shell And Theme System

The app is tray-first, but the main window still matters because that is where diagnostics, profiles, and review tooling live.

## Tray shell responsibilities

- expose the app even when the main window is hidden
- provide a fast suspend path
- reopen the main window without rebuilding state
- stay single-instance

## Theme system

Theme support is treated as a product requirement, not polish.

- default theme preference is `system`
- manual `light` and `dark` overrides are supported
- the frontend applies a document theme token
- the desktop shell also updates native window theme preference

The browser preview and the Tauri runtime share the same theme contract so tests and desktop behavior cannot silently drift apart.
