# Debugging Workflow

GlareMute is designed so agents can inspect failures locally before asking for user help.

## First places to look

### In-app diagnostics

The main window exposes:

- backend identity
- current settings path
- current log path
- recent events from the runtime

### Log file

The desktop shell writes structured logs to the app log directory shown in the UI.

### Debug report

Use the `Copy Debug Report` action to capture a snapshot that includes:

- settings
- platform capability map
- recent events
- runtime file paths

## Typical failure triage

1. Reproduce in browser preview if the issue is UI-only.
2. Reproduce in the desktop shell if tray, path, or Tauri behavior is involved.
3. Check the diagnostics panel before inspecting raw files.
4. Open the logs directory if the in-app event buffer is not enough.
5. Escalate to the user only when the bug depends on an environment detail the app cannot report itself.
