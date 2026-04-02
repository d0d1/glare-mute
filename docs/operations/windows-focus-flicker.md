# Windows Focus Flicker Note

This note records a failed April 2026 attempt to reduce focus-return flicker in the Windows Magnification backend.

## Observed behavior

When a covered app lost focus and then regained it, the effect could visibly flicker during the activation handoff.

## What was tried

Two speculative changes were attempted in the Magnification overlay loop:

1. Cache overlay presentation state and skip repeated `SetWindowPos`, `ShowWindow`, and `MagSetWindowSource` calls when the target bounds looked unchanged.
2. Add a short grace period before hiding a surface when the target was briefly unavailable during focus changes.

## What failed

The aggressive caching attempt made rendering worse. In the broken state, covered windows could turn entirely white.

The likely mistake was treating `MagSetWindowSource(...)` like a geometry-only update. On this backend it appears to be part of the live refresh path, not just a rect-change path.

## What to avoid repeating blindly

- Do not assume the Magnification control can safely skip `MagSetWindowSource(...)` when the target rect is unchanged.
- Do not assume repeated `present()` churn is purely waste. Some of it may be required to keep the copied content live.
- Do not stack more speculative timing tweaks on top of a broken overlay experiment near release.

## Safe conclusion from this attempt

The current code did not prove that focus-return flicker is easy to solve by local loop throttling alone.

It did show that careless caching inside the overlay path is risky and can break core rendering.

## Better next experiments

If this issue is revisited, prefer narrower evidence-gathering steps:

1. Log exactly which focus-return path is happening:
   - repeated `present()` with stable rect
   - transient `presentation_target(...) == None`
   - repeated z-order changes in `insert_after`
2. Test whether the flicker correlates more with:
   - hide/show churn
   - z-order repositioning
   - or unavoidable Magnification refresh behavior
3. Try isolated experiments one at a time:
   - hide grace only
   - `ShowWindow` suppression only
   - z-order update suppression only when `insert_after` is unchanged
4. If the current backend keeps resisting clean focus behavior, treat that as more evidence for the `Windows.Graphics.Capture` fallback path rather than endlessly tuning Magnification heuristics.

## Release-minded recommendation

For release work, revert to the last known-good Magnification behavior before this experiment. Treat the focus flicker as a known limitation unless it becomes severe enough to block release.
