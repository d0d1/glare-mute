# Desktop Shell And Theme System

The app is tray-first, but the main window still matters because that is where saved apps, diagnostics, and review tooling live.

## Tray shell responsibilities

- expose the app even when the main window is hidden
- provide fast access back to the current saved app state
- reopen the main window without rebuilding state
- stay single-instance

## Theme system

Theme support is treated as a product requirement, not polish.

- default theme preference is `system`
- manual `light`, `dark`, `invert`, and `greyscaleInvert` overrides are supported
- the frontend applies a document theme token
- the desktop shell also updates native window theme preference

The browser preview and the Tauri runtime share the same theme contract so tests and desktop behavior cannot silently drift apart.
