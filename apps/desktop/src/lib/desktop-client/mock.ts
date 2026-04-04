import type {
  AppLanguage,
  AppSnapshot,
  ProfileRule,
  ThemePreference,
  VisualPreset,
  WindowDescriptor,
} from "../contracts";
import { defaultWindowCandidates } from "./mock-data";
import { readSnapshot, writeSnapshot } from "./mock-snapshot";
import type { DesktopClient } from "./types";

export function createMockDesktopClient(): DesktopClient {
  return {
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
      }

      recomputeLens(snapshot);
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
      recomputeLens(snapshot);
      writeSnapshot(snapshot);
      return snapshot;
    },
    async removeProfile(profileId) {
      const snapshot = readSnapshot();
      const index = snapshot.settings.profiles.findIndex((profile) => profile.id === profileId);
      if (index === -1) {
        throw new Error(`No saved app found for ${profileId}.`);
      }

      const [removed] = snapshot.settings.profiles.splice(index, 1);
      recomputeLens(snapshot);
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: `removed saved app ${removed.label || removed.executablePath}`,
      });
      writeSnapshot(snapshot);
      return snapshot;
    },
    async saveProfileFromWindow(windowId, preset) {
      const snapshot = readSnapshot();
      const candidate = snapshot.windowCandidates.find(
        (entry) => entry.logicalTargetId === windowId || entry.windowId === windowId
      );

      if (!candidate) {
        throw new Error(`No mock window found for ${windowId}.`);
      }
      if (!["greyscaleInvert", "invert"].includes(preset)) {
        throw new Error(`${preset} is not available in the current build.`);
      }
      if (!candidate.executablePath) {
        throw new Error("The selected mock window does not expose an executable path.");
      }

      upsertProfile(snapshot.settings.profiles, candidate, preset);
      recomputeLens(snapshot);
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: `saved ${preset} for ${profileLabelForWindow(candidate)}`,
      });
      writeSnapshot(snapshot);
      return snapshot;
    },
    async setApplyToRelatedWindows(enabled) {
      const snapshot = readSnapshot();
      snapshot.settings.applyToRelatedWindows = enabled;
      recomputeLens(snapshot);
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: enabled ? "related window coverage enabled" : "related window coverage disabled",
      });
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
    async setProfileEnabled(profileId: string, enabled: boolean) {
      const snapshot = readSnapshot();
      const profile = snapshot.settings.profiles.find((entry) => entry.id === profileId);
      if (!profile) {
        throw new Error(`No saved app found for ${profileId}.`);
      }

      profile.enabled = enabled;
      recomputeLens(snapshot);
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: enabled
          ? `enabled saved app ${profile.label || profile.executablePath}`
          : `disabled saved app ${profile.label || profile.executablePath}`,
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

function recomputeLens(snapshot: AppSnapshot) {
  const profileSnapshots = snapshot.settings.profiles.map((profile) => {
    const matchingTargets = profile.enabled
      ? resolveProfileTargets(
          snapshot.windowCandidates,
          profile,
          snapshot.settings.applyToRelatedWindows
        )
      : [];

    return {
      profileId: profile.id,
      label: profile.label || fallbackProfileLabel(profile),
      enabled: profile.enabled,
      preset: profile.preset,
      matchingTargets,
    };
  });

  const coveredTargets = dedupeLogicalTargets(
    profileSnapshots.flatMap((profile) => profile.matchingTargets)
  );
  const visibleCount = coveredTargets.filter(
    (target) => target.attachmentState === "available"
  ).length;
  const enabledProfiles = snapshot.settings.profiles.filter((profile) => profile.enabled).length;

  snapshot.lens = {
    coveredTargets,
    profileSnapshots,
    backendLabel: "Mock transform backend",
    status: enabledProfiles === 0 ? "detached" : visibleCount > 0 ? "attached" : "pending",
    summary:
      enabledProfiles === 0
        ? "No saved apps are active in the browser preview."
        : visibleCount > 0
          ? `Effects are active on ${Math.max(visibleCount, 1)} windows across ${enabledProfiles} saved apps.`
          : enabledProfiles === 1
            ? "A saved effect is waiting for a matching window."
            : `${enabledProfiles} saved effects are waiting for matching windows.`,
  };
}

function resolveProfileTargets(
  candidates: AppSnapshot["windowCandidates"],
  profile: ProfileRule,
  applyToRelatedWindows: boolean
) {
  const directMatches = candidates.filter((candidate) =>
    profileMatchesCandidate(profile, candidate)
  );
  if (!applyToRelatedWindows) {
    return directMatches;
  }
  if (directMatches.some((candidate) => isAmbiguousHostCandidate(candidate))) {
    return directMatches;
  }

  const processIds = new Set(directMatches.map((candidate) => candidate.processId));
  return dedupeLogicalTargets(
    candidates.filter(
      (candidate) =>
        processIds.has(candidate.processId) || profileMatchesCandidate(profile, candidate)
    )
  );
}

function profileMatchesCandidate(profile: ProfileRule, candidate: WindowDescriptor) {
  if (!candidate.executablePath) {
    return false;
  }
  if (candidate.executablePath.toLowerCase() !== profile.executablePath.toLowerCase()) {
    return false;
  }
  if (
    profile.windowClass &&
    (candidate.windowClass ?? "").toLowerCase() !== profile.windowClass.toLowerCase()
  ) {
    return false;
  }
  if (profile.titlePattern) {
    const normalizedPattern = profile.titlePattern.trim().toLowerCase();
    const normalizedTitle = candidate.title.trim().toLowerCase();
    if (
      normalizedPattern &&
      !(isAmbiguousHostProfile(profile)
        ? normalizedTitle === normalizedPattern
        : normalizedTitle.includes(normalizedPattern))
    ) {
      return false;
    }
  }

  return true;
}

function dedupeLogicalTargets(targets: WindowDescriptor[]) {
  const seen = new Set<string>();
  return targets.filter((target) => {
    if (seen.has(target.logicalTargetId)) {
      return false;
    }

    seen.add(target.logicalTargetId);
    return true;
  });
}

function upsertProfile(profiles: ProfileRule[], candidate: WindowDescriptor, preset: VisualPreset) {
  const executablePath = candidate.executablePath;
  if (!executablePath) {
    return;
  }

  const existing = profiles.find(
    (profile) =>
      profile.executablePath.toLowerCase() === executablePath.toLowerCase() &&
      profile.titlePattern === null &&
      profile.windowClass === (candidate.windowClass ?? null)
  );
  if (existing) {
    existing.enabled = true;
    existing.preset = preset;
    existing.label = profileLabelForWindow(candidate);
    return;
  }

  profiles.push({
    id: `profile-${Date.now()}-${profiles.length + 1}`,
    enabled: true,
    label: profileLabelForWindow(candidate),
    executablePath,
    preset,
    titlePattern: profileTitlePatternForWindow(candidate),
    windowClass: candidate.windowClass ?? null,
    notes: null,
  });
}

function profileLabelForWindow(candidate: WindowDescriptor) {
  if (isAmbiguousHostCandidate(candidate)) {
    return candidate.title;
  }

  return executableName(candidate.executablePath) ?? candidate.title;
}

function profileTitlePatternForWindow(candidate: WindowDescriptor) {
  if (isAmbiguousHostCandidate(candidate)) {
    return candidate.title.trim().toLowerCase();
  }

  return null;
}

function isAmbiguousHostCandidate(candidate: WindowDescriptor) {
  return (
    (candidate.windowClass ?? "").toLowerCase().includes("applicationframe") ||
    isHostProcessName(executableName(candidate.executablePath))
  );
}

function isAmbiguousHostProfile(profile: ProfileRule) {
  return (
    (profile.windowClass ?? "").toLowerCase().includes("applicationframe") ||
    isHostProcessName(executableName(profile.executablePath))
  );
}

function isHostProcessName(name: string | null) {
  return name?.toLowerCase() === "applicationframehost" || name?.toLowerCase() === "systemsettings";
}

function fallbackProfileLabel(profile: ProfileRule) {
  return executableName(profile.executablePath) ?? profile.executablePath;
}

function executableName(path: string | null) {
  if (!path) {
    return null;
  }

  const segments = path.split(/[/\\]/);
  const fileName = segments.at(-1) ?? path;
  return fileName.replace(/\.exe$/i, "");
}
