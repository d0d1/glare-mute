# Backend Strategy

The current v1 path is intentionally narrow: prove trustworthy per-window accessibility effects on Windows before expanding the effect catalog.

## Current shipped effect family

The native effect surface currently centers on transform presets:

- `Invert`
- `Greyscale Invert`

`Invert` is the default because it tested better than expected on the real IRPF target app while keeping more recognizable color structure than grayscale.
`Greyscale Invert` remains available for harsher white-heavy screens where maximum glare reduction matters more than visual fidelity.

## Current backend

Today the Windows desktop shell uses:

- explicit top-level window enumeration as the picker
- related-window coverage within the same running app when possible
- the Windows Magnification API for the current `Invert` and `Greyscale Invert` implementations
- one user-facing `Turn off` action rather than separate pause/off controls

This backend is the only currently proven native path for the product.

## Strategic position

Magnification is the current implementation, but it is not the assumed long-term winner.

The backend decision remains open because the product still needs better evidence on:

- unfocused visible coverage behavior across more app topologies
- overlap and z-order edge cases
- compatibility with more legacy Windows apps

## Next fallback path

`Windows.Graphics.Capture` plus a shader/compositor pipeline remains the main fallback and validation path if Magnification stops scaling to the product requirements.

That path is attractive because it could improve:

- effect persistence while the target remains visible but unfocused
- future transform experimentation
- separation between capture/render logic and effect logic

It is still a validation path, not the active production backend.

## Explicitly out of scope for v1

- generic in-process theme injection
- toolkit-specific hooks
- cross-platform delivery
- promising a semantic dark mode for arbitrary legacy apps

Those paths either increase maintenance cost too sharply or overpromise what the current safe architecture can credibly deliver.
