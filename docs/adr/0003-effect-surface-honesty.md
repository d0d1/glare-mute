# ADR 0003: Effect Surface Honesty

## Status

Accepted

## Context

GlareMute had drifted into exposing product concepts that were not honest enough:

- a faux `Dark` effect that did not produce a credible dark-mode result
- separate `Pause` and `Turn off` controls that had no meaningful user-visible distinction
- a displayed shortcut value with no real hotkey implementation behind it

That combination made the surface noisier and less trustworthy than the product needed to be.

## Decision

- Remove the faux `Dark` effect from the product and native implementation.
- Keep only effect options that are real and supportable now.
- Expose a single off action in the user-facing workflow instead of separate pause/off controls.
- Keep suspend as an internal runtime concept only for startup/debug bookkeeping unless a future user-visible use case proves it belongs back in the product.
- Do not show shortcut UI until there is an actual implemented hotkey behind it.

## Consequences

- The effect chooser stays smaller but more honest.
- Future contributors should not casually reintroduce fake dark-mode claims.
- Future contributors should not re-expose pause/suspend unless they can point to a concrete user-visible benefit over the single off action.
