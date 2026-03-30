# ADR 0001: Tauri + Rust + React

## Status

Accepted

## Context

The project needs:

- native tray and path integrations
- fast iteration on the UI
- browser-based automated review
- a clean place to isolate Windows APIs

## Decision

Use:

- Tauri 2 for the desktop shell
- Rust for native state, lifecycle, diagnostics, and platform integration
- React + TypeScript for the UI

## Consequences

- agents can run the UI in a pure browser preview for Playwright review
- Windows backend work stays in Rust where it belongs
- the frontend remains testable without launching a real desktop app for every change
