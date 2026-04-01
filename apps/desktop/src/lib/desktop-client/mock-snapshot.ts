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
        preset: normalizePersistedPresetId(profile.preset),
      })),
    },
    lens: {
      ...snapshot.lens,
      activePreset: normalizeOptionalPresetId(snapshot.lens.activePreset),
      activeTarget: snapshot.lens.activeTarget
        ? normalizeWindowDescriptor(snapshot.lens.activeTarget as WindowDescriptor)
        : null,
      coveredTargets: (
        (snapshot.lens as AppSnapshot["lens"] & { coveredTargets?: WindowDescriptor[] })
          .coveredTargets ?? (snapshot.lens.activeTarget ? [snapshot.lens.activeTarget] : [])
      ).map((descriptor) => normalizeWindowDescriptor(descriptor)),
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

function normalizeOptionalPresetId(preset: LegacyVisualPreset | null): VisualPreset | null {
  return preset === null ? null : normalizePersistedPresetId(preset);
}
