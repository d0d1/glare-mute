# Backend Strategy

The agreed v1 backend direction is hybrid, not monolithic.

## Effect families

### Tint backend

This is the zero-lag path for:

- Darken
- Warm Dim
- future glare-reduction presets that do not need pixel remapping

This backend is the reliability anchor for v1.

### Transform backend

This is the higher-risk path for:

- Greyscale Invert
- future invert-style presets

The current first native slice uses this path directly for `Greyscale Invert` because it already proved valuable on the target IRPF app during system-wide grayscale inversion testing.

The project is explicitly not anchored to one implementation yet.

## Transform candidates

### Magnification API

This is the first spike candidate because it matches the product shape unusually well:

- source rectangle based
- color transform capable
- native Windows accessibility lineage

It is still treated as experimental until real latency and compatibility measurements justify promoting it.

## Current implementation note

Today the Windows desktop shell uses:

- explicit top-level window enumeration as the picker
- Magnification API for the first native `Greyscale Invert` implementation
- suspend/detach controls in both the dashboard and tray

Tint presets remain in the contract, but they are not the first implemented native backend.

### Windows Graphics Capture plus shader

This remains a first-class fallback and possible long-term production path for transform mode.

## Out of v1

- generic in-process theme injection
- toolkit-specific hooks
- cross-platform delivery

Those paths either increase maintenance cost too sharply or fail the trust and compatibility goals for the first release.
