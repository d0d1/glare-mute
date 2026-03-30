# Windows IRPF Test Flow

This is the current native test path for GlareMute.

## What the first native slice does

- lists visible top-level application windows
- lets the user attach `Greyscale Invert` to one selected window
- tracks that main window while it stays visible and in the active focus family
- lets the user suspend or detach the lens from the dashboard or tray

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
3. Click `Refresh Windows`.
4. Find the IRPF window in the `Window Picker` list.
5. Click `Attach Greyscale Invert`.
6. Use `Suspend Lens` if you need an immediate off switch without losing the selected target.
7. Use `Detach Lens` if you want to drop the attachment entirely.

## Known limits of this slice

- only `Greyscale Invert` is wired natively right now
- the picker is a window list, not a crosshair picker
- popup coverage is not implemented yet
- the overlay hides when the target is not the active focus family
- this path is Windows-only
