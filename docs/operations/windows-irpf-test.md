# Windows IRPF Test Flow

This is the current native test path for GlareMute.

## What the first native slice does

- keeps a live, stable list of top-level application windows, including minimized ones
- lets the user choose an effect and apply either `Greyscale Invert` or `Dark` to one selected window
- tracks that main window while it stays visible, even if another app takes focus
- lets the user pause or turn off the effect from the app window or tray

## Start the web frontend

From WSL or another shell with the repo-local JavaScript toolchain available:

```bash
pnpm dev:web
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
2. Bring `GlareMute` to the foreground.
3. In `Available windows`, select the IRPF window from the live list.
4. In `Effect`, confirm `Greyscale Invert` is selected.
5. Click `Apply Greyscale Invert`.
6. If the IRPF window is minimized, leave it selected and apply the effect anyway. The effect will appear once the window is back on screen.
7. Use `Pause` if you need an immediate off switch without losing the selected target.
8. Use `Turn off` if you want to clear the effect entirely.
9. Move focus to another app, including another monitor if available, and confirm the IRPF window keeps its effect while it stays visible.
10. If `Greyscale Invert` is too harsh, try `Dark` for a cooler Windows-dark-inspired treatment.
11. Open `Settings` if you need to change GlareMute's own theme.
12. Open `Support & diagnostics` only in dev builds if you need logs or a debug report.

## Known limits of this slice

- only `Greyscale Invert` and `Dark` are wired natively right now
- the picker is a window list, not a crosshair picker
- minimized windows can be selected and applied, but nothing is visible until the window is back on screen
- popup coverage is not implemented yet
- overlap and z-order edge cases can still appear because the overlay is synchronized against the target window rather than becoming a compositor primitive
- this path is Windows-only
