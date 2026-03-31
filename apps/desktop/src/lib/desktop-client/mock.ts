import type { AppLanguage, AppSnapshot, ThemePreference, WindowDescriptor } from "../contracts";
import { defaultWindowCandidates } from "./mock-data";
import { readSnapshot, writeSnapshot } from "./mock-snapshot";
import type { DesktopClient } from "./types";

export function createMockDesktopClient(): DesktopClient {
  return {
    async attachWindow(windowId, preset) {
      const snapshot = readSnapshot();
      const candidate = snapshot.windowCandidates.find((entry) => entry.windowId === windowId);

      if (!candidate) {
        throw new Error(`No mock window found for ${windowId}.`);
      }
      if (!["greyscaleInvert", "invert"].includes(preset)) {
        throw new Error(`${preset} is not available in the current build.`);
      }

      const coveredTargets = relatedWindowTargets(snapshot, candidate);
      const status = mockLensStatus(coveredTargets);
      snapshot.lens = {
        activePreset: preset,
        activeTarget: candidate,
        coveredTargets,
        backendLabel: "Mock transform backend",
        status,
        summary: mockLensSummary(preset, candidate, coveredTargets, status),
      };
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message:
          status === "pending"
            ? `applied ${preset} to ${candidate.title}; it will appear once the window is back on screen`
            : snapshot.settings.applyToRelatedWindows && coveredTargets.length > 1
              ? `applied ${preset} to ${coveredTargets.length} windows from the same app`
              : `applied ${preset} to ${candidate.title}`,
      });
      writeSnapshot(snapshot);
      return snapshot;
    },
    async appendFrontendLog(level, source, message) {
      const snapshot = readSnapshot();
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level,
        source,
        message,
      });
      snapshot.diagnostics.recentEvents = snapshot.diagnostics.recentEvents.slice(0, 24);
      writeSnapshot(snapshot);
    },
    async bootstrapState() {
      const snapshot = readSnapshot();
      if (snapshot.diagnostics.recentEvents.length === 0) {
        snapshot.diagnostics.recentEvents.push({
          timestamp: new Date().toISOString(),
          level: "info",
          source: "mock-runtime",
          message: "browser preview booted with the shared desktop contract",
        });
        writeSnapshot(snapshot);
      }

      return snapshot;
    },
    async detachLens() {
      const snapshot = readSnapshot();
      snapshot.lens = {
        activePreset: null,
        activeTarget: null,
        coveredTargets: [],
        backendLabel: "Mock transform backend",
        status: "detached",
        summary: "No effect is active in the browser preview.",
      };
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: "turned off the current mock effect",
      });
      writeSnapshot(snapshot);
      return snapshot;
    },
    async getDebugReport() {
      return JSON.stringify(readSnapshot(), null, 2);
    },
    async openLogsDirectory() {
      const snapshot = readSnapshot();
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: "log directory open request ignored in browser preview",
      });
      writeSnapshot(snapshot);
    },
    async refreshWindowCandidates() {
      const snapshot = readSnapshot();
      snapshot.windowCandidates = defaultWindowCandidates();
      if (snapshot.lens.activeTarget) {
        const nextTarget =
          snapshot.windowCandidates.find(
            (entry) => entry.windowId === snapshot.lens.activeTarget?.windowId
          ) ??
          snapshot.windowCandidates.find(
            (entry) => entry.processId === snapshot.lens.activeTarget?.processId
          ) ??
          null;
        snapshot.lens.activeTarget = nextTarget;
        if (nextTarget) {
          const coveredTargets = relatedWindowTargets(snapshot, nextTarget);
          const status = mockLensStatus(coveredTargets);
          snapshot.lens.coveredTargets = coveredTargets;
          snapshot.lens.status = status;
          snapshot.lens.summary = mockLensSummary(
            snapshot.lens.activePreset ?? "invert",
            nextTarget,
            coveredTargets,
            status
          );
        } else {
          snapshot.lens = {
            activePreset: null,
            activeTarget: null,
            coveredTargets: [],
            backendLabel: snapshot.lens.backendLabel,
            status: "detached",
            summary: "No effect is active in the browser preview.",
          };
        }
      }
      writeSnapshot(snapshot);
      return snapshot;
    },
    async setApplyToRelatedWindows(enabled) {
      const snapshot = readSnapshot();
      snapshot.settings.applyToRelatedWindows = enabled;
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: enabled ? "related window coverage enabled" : "related window coverage disabled",
      });
      if (snapshot.lens.activeTarget) {
        const coveredTargets = relatedWindowTargets(snapshot, snapshot.lens.activeTarget);
        const status = mockLensStatus(coveredTargets);
        snapshot.lens.coveredTargets = coveredTargets;
        snapshot.lens.status = status;
        snapshot.lens.summary = mockLensSummary(
          snapshot.lens.activePreset ?? "invert",
          snapshot.lens.activeTarget,
          coveredTargets,
          status
        );
      }
      writeSnapshot(snapshot);
      return snapshot;
    },
    async setLanguage(language: AppLanguage) {
      const snapshot = readSnapshot();
      snapshot.settings.language = language;
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: `language updated to ${language}`,
      });
      writeSnapshot(snapshot);
      return snapshot;
    },
    async setThemePreference(theme: ThemePreference) {
      const snapshot = readSnapshot();
      snapshot.settings.themePreference = theme;
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: `theme preference updated to ${theme}`,
      });
      writeSnapshot(snapshot);
      return snapshot;
    },
  };
}

function mockLensSummary(
  preset: AppSnapshot["lens"]["activePreset"] extends infer T ? Exclude<T, null> : never,
  activeTarget: AppSnapshot["lens"]["activeTarget"],
  coveredTargets: AppSnapshot["lens"]["coveredTargets"],
  status: AppSnapshot["lens"]["status"]
) {
  const label =
    preset === "invert" ? "Invert" : preset === "warmDim" ? "Warm Dim" : "Greyscale Invert";
  const visibleCount = coveredTargets.filter(
    (target) => target.attachmentState === "available"
  ).length;
  const coveredCount = coveredTargets.length;

  switch (status) {
    case "pending":
      return coveredCount > 1
        ? `${label} will appear when the selected app is back on screen.`
        : `${label} will appear when ${activeTarget?.title ?? "the selected window"} is back on screen.`;
    case "attached":
      return coveredCount > 1
        ? `${label} is active on ${Math.max(visibleCount, 1)} windows from the same app.`
        : `${label} is active on ${activeTarget?.title ?? "the selected window"}.`;
    case "suspended":
      return "The current effect is paused in the browser preview.";
    case "detached":
      return "No effect is active in the browser preview.";
  }
}

function mockLensStatus(
  coveredTargets: AppSnapshot["lens"]["coveredTargets"]
): AppSnapshot["lens"]["status"] {
  if (coveredTargets.length === 0) {
    return "detached";
  }

  return coveredTargets.some((target) => target.attachmentState === "available")
    ? "attached"
    : "pending";
}

function relatedWindowTargets(
  snapshot: AppSnapshot,
  candidate: WindowDescriptor
): AppSnapshot["lens"]["coveredTargets"] {
  return snapshot.settings.applyToRelatedWindows
    ? snapshot.windowCandidates.filter((entry) => entry.processId === candidate.processId)
    : [candidate];
}
