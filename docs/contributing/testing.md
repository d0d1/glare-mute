# Testing Workflow

## Browser preview

Use the browser preview for most UI verification:

```bash
pnpm test:e2e
```

Playwright is the review gate for visual work.
The e2e command builds the app and runs screenshots against a dedicated preview server on `127.0.0.1:1421`, not the hot-reloading dev server.

## Unit tests

Use Vitest for fast logic tests around the shared client and theme helpers:

```bash
pnpm test:unit
```

## Rust checks

Validate shared contracts and desktop compilation separately:

```bash
cargo test -p glare-mute-core -p glare-mute-platform
cargo check -p glare-mute-desktop
```

For the native Windows shell itself, also validate a direct Windows compile:

```cmd
cd /d C:\Users\dbhul\code\glare-mute
cargo check -p glare-mute-desktop
```

Use the [Windows IRPF test flow](../operations/windows-irpf-test.md) when the change affects window enumeration, Magnification API behavior, or tray safety controls.

## Why the split exists

- Playwright gives screenshot-backed confidence for the shell
- Vitest keeps pure logic validation fast
- Rust checks protect the native integration layer without requiring full packaging
- the direct Windows compile catches Win32 binding drift that Linux checks cannot see
