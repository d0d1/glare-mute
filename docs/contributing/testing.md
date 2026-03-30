# Testing Workflow

## Browser preview

Use the browser preview for most UI verification:

```bash
pnpm build:web
pnpm test:e2e
```

Playwright is the review gate for visual work.

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

## Why the split exists

- Playwright gives screenshot-backed confidence for the shell
- Vitest keeps pure logic validation fast
- Rust checks protect the native integration layer without requiring full packaging
