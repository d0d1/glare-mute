# Glare mute

Glare mute is a Windows accessibility app for people who need bright apps toned down without changing the rest of the desktop.

## What it does

- shows a live list of windows you can target
- applies **Invert** or **Greyscale Invert** to the selected window
- can keep the effect on related windows from the same app when that is reliable
- lets you turn the effect off quickly from the app or tray

## Current scope

Glare mute is currently focused on a narrow Windows v1:

- Windows desktop app
- real per-window effects for bright apps that ignore dark mode
- current built-in effects: **Invert** and **Greyscale Invert**

## Preview

A typical use case is a bright legacy tax app that stays white even when the rest of Windows is dark.

### Original

![Bright IRPF window before applying an effect](docs/images/01_irpf_original.png)

### Invert applied

![IRPF window with Glare mute invert applied](docs/images/02_irpf_inverted.png)

## How to use

1. Open the app you want to soften.
2. Open Glare mute and pick that window from the list.
3. Choose **Invert** or **Greyscale Invert**.
4. Apply the effect.
5. Turn it off when you are done.

## Privacy and local processing

Glare mute is local software.

- no telemetry
- no analytics
- no account required
- no subscription
- no runtime dependency on external services
- window targeting and effect handling happen on your own machine

## Platform support

- **Windows:** supported target platform for the current app
- **Other platforms:** not supported in the current release scope

## Install / release status

Glare mute is still in an early Windows-first release stage. The repository can build a production desktop executable, but the project is still being tightened before a broader end-user release.

## License

GPL-3.0-only
