# ADR 0002: Hybrid Lens Backends

## Status

Accepted

## Context

The product needs both:

- a reliable low-latency path
- a path toward invert-style transforms

No single implementation serves both constraints cleanly.

## Decision

Adopt two backend families:

- tint backend for zero-lag dimming
- transform backend for invert-style presets

Treat Magnification API as the first transform spike, but keep Graphics Capture plus shader as an equal strategic option.

## Consequences

- v1 can ship value without waiting for full transform-mode certainty
- the architecture stays honest about reliability differences
- the project avoids hard-anchoring itself to an API that may fail later measurements
