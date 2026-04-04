import type { AppLanguage, AppSnapshot, VisualPreset, WindowDescriptor } from "../contracts";
import { defaultSnapshot } from "./mock-data";

function normalizeWindowDescriptor(
  descriptor: WindowDescriptor & { logicalTargetId?: string; secondaryLabel?: string | null }
): WindowDescriptor {
  return {
    ...descriptor,
    logicalTargetId: descriptor.logicalTargetId ?? descriptor.windowId,
    secondaryLabel: descriptor.secondaryLabel ?? null,
  };
}

const STORAGE_KEY = "glaremute:preview-snapshot";
type LegacyVisualPreset = VisualPreset | "dark" | "darken";

export function readSnapshot(): AppSnapshot {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const snapshot = normalizeSnapshot(JSON.parse(stored) as AppSnapshot);
    writeSnapshot(snapshot);
    return snapshot;
  }

  const snapshot = defaultSnapshot();
  writeSnapshot(snapshot);
  return snapshot;
}

export function writeSnapshot(snapshot: AppSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function resetMockSnapshot() {
  localStorage.removeItem(STORAGE_KEY);
}

export function normalizeSnapshot(snapshot: AppSnapshot): AppSnapshot {
  return {
    ...snapshot,
    presets: snapshot.presets.map((preset) => ({
      ...preset,
      id: normalizePersistedPresetId(preset.id),
      label: normalizePersistedPresetId(preset.id) === "invert" ? "Invert" : preset.label,
    })),
    settings: {
      ...snapshot.settings,
      language:
        (snapshot.settings as AppSnapshot["settings"] & { language?: AppLanguage }).language ??
        "system",
      applyToRelatedWindows:
        (snapshot.settings as AppSnapshot["settings"] & { applyToRelatedWindows?: boolean })
          .applyToRelatedWindows ?? true,
      profiles: snapshot.settings.profiles.map((profile) => ({
        ...profile,
        id: profile.id ?? profile.executablePath,
        enabled: profile.enabled ?? true,
        label: profile.label ?? "",
        preset: normalizePersistedPresetId(profile.preset),
      })),
    },
    lens: {
      ...snapshot.lens,
      coveredTargets: (
        (snapshot.lens as AppSnapshot["lens"] & { coveredTargets?: WindowDescriptor[] })
          .coveredTargets ?? []
      ).map((descriptor) => normalizeWindowDescriptor(descriptor)),
      profileSnapshots: (
        (
          snapshot.lens as AppSnapshot["lens"] & {
            profileSnapshots?: (AppSnapshot["lens"]["profileSnapshots"][number] & {
              profileId?: string;
              matchingTargets?: WindowDescriptor[];
            })[];
          }
        ).profileSnapshots ?? []
      ).map((profile) => ({
        ...profile,
        profileId: profile.profileId ?? profile.label,
        matchingTargets: (profile.matchingTargets ?? []).map((descriptor) =>
          normalizeWindowDescriptor(descriptor)
        ),
      })),
    },
    windowCandidates: snapshot.windowCandidates.map((descriptor) =>
      normalizeWindowDescriptor(descriptor)
    ),
  };
}

export function normalizePersistedPresetId(preset: LegacyVisualPreset): VisualPreset {
  if (preset === "dark" || preset === "darken") {
    return "greyscaleInvert";
  }

  return preset;
}
