# Debugging Workflow

Glare mute exposes enough local diagnostics to inspect most failures before asking for extra environment detail.

## First places to look

### In-app diagnostics

The main window exposes:

- backend identity
- active lens state
- selected window details
- saved app state and runtime status
- current window candidate list
- current settings path
- current log path
- recent events from the runtime

### Log file

The desktop shell writes structured logs to the app log directory shown in the UI.

On Windows the current default path is:

`%LOCALAPPDATA%\com.d0d1.glaremute\logs\glare-mute.log`

### Debug report

Use the `Copy Debug Report` action to capture a snapshot that includes:

- settings
- platform capability map
- active lens state
- current window candidates
- recent events
- runtime file paths

## Typical failure triage

1. Reproduce in browser preview if the issue is UI-only.
2. Reproduce in the desktop shell if tray, path, or Tauri behavior is involved.
3. Check the diagnostics panel before inspecting raw files.
4. Confirm the selected window id, title, executable path, and class before assuming picker failure.
5. Confirm the saved app rule that was created for that window before assuming the native matcher is wrong.
6. Open the logs directory if the in-app event buffer is not enough.
7. Ask for extra environment detail only when the app cannot report enough on its own.
