# Windows IRPF Test Flow

This is the current native test path for GlareMute.

## What the first native slice does

- lists top-level application windows, including minimized restore-first entries
- lets the user choose an effect and attach `Greyscale Invert` to one selected window
- tracks that main window while it stays visible and in the active focus family
- lets the user suspend or detach the lens from the app window or tray

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
3. In `Available windows`, click `Refresh list`.
4. Select the IRPF window from the `Ready now` group.
5. In `Lens`, confirm `Greyscale Invert` is selected.
6. Click `Attach Greyscale Invert`.
7. If the IRPF window is minimized, restore it before attaching.
8. Use `Suspend lens` if you need an immediate off switch without losing the selected target.
9. Use `Detach lens` if you want to drop the attachment entirely.
10. Open `Settings` if you need to change GlareMute's own theme.
11. Open `Support & diagnostics` only in dev builds if you need logs or a debug report.

## Known limits of this slice

- only `Greyscale Invert` is wired natively right now
- the picker is a window list, not a crosshair picker
- minimized windows are listed for context but still cannot be attached until restored
- popup coverage is not implemented yet
- the overlay hides when the target is not the active focus family
- this path is Windows-only
