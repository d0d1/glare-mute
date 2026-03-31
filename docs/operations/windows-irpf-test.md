# Windows IRPF Test Flow

This is the current native test path for Glare mute.

## What the first native slice does

- keeps a live, stable list of top-level application windows, including minimized ones
- lets the user choose an effect and apply either `Greyscale Invert` or `Invert` to the selected window, plus related windows from the same running app when enabled
- tracks covered windows while they stay visible, even if another app takes focus
- lets the user turn off the effect from the app window or tray

## Start the web frontend

From WSL or another shell with the repo-local JavaScript toolchain available:

```bash
corepack pnpm dev:web
```

This serves the UI on `http://127.0.0.1:1420`.

## Start the Windows desktop shell

From Windows:

```cmd
cd /d C:\Users\dbhul\code\glare-mute
set TAURI_DEV_HOST=127.0.0.1
cargo run -p glare-mute-desktop
```

The desktop shell uses the live frontend from the dev server and writes logs to:

`%LOCALAPPDATA%\com.d0d1.glaremute\logs\glare-mute.log`

## Test against IRPF

1. Launch the IRPF desktop app and make sure its main window is visible.
2. Bring `Glare mute` to the foreground.
3. In `Available windows`, select the IRPF window from the live list.
4. In `Effect`, confirm `Invert` is selected.
5. Click `Apply Invert`.
6. If the IRPF window is minimized, leave it selected and apply the effect anyway. The effect will appear once the window is back on screen.
7. Leave `Apply to related windows` enabled in `Settings` if you want new IRPF dialogs from the same app session to pick up the same effect automatically.
8. Open another IRPF top-level dialog if available and confirm it receives the same effect without replacing the first covered window.
9. Use `Turn off` if you want to clear the effect entirely.
10. Move focus to another app, including another monitor if available, and confirm the IRPF window keeps its effect while it stays visible.
11. If `Invert` is not strong enough, try `Greyscale Invert` for harsher white-heavy screens.
12. Open `Settings` if you need to change Glare mute's own theme or related-window coverage.
13. Open `Support & diagnostics` only in dev builds if you need logs or a debug report.

## Known limits of this slice

- only `Greyscale Invert` and `Invert` are wired natively right now
- the picker is a window list, not a crosshair picker
- minimized windows can be selected and applied, but nothing is visible until the window is back on screen
- same-process top-level windows can be covered together, but popup/owned-window coverage is not complete yet
- overlap and z-order edge cases can still appear because the overlay is synchronized against the target window rather than becoming a compositor primitive
- this path is Windows-only
