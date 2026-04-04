import type { StatusTone } from "../../components/StatusChip";
import type { AppSnapshot, PresetDefinition, RuntimeEvent } from "../../lib/contracts";
import type { Messages } from "../../lib/i18n";

export function effectStatusLabel(messages: Messages, status: AppSnapshot["lens"]["status"]) {
  return messages.savedProfileStatusLabel(
    status === "attached" ? "active" : status === "pending" ? "closed" : "off"
  );
}

export function effectStatusChip(status: AppSnapshot["lens"]["status"]): StatusTone {
  switch (status) {
    case "pending":
      return "neutral";
    case "attached":
      return "available";
    case "detached":
      return "neutral";
    case "suspended":
      return "neutral";
  }
}

export function savedProfileStatusTone(
  status: "active" | "minimized" | "closed" | "off"
): StatusTone {
  switch (status) {
    case "active":
      return "available";
    case "minimized":
    case "closed":
    case "off":
      return "neutral";
  }
}

export function localizePresetDefinitions(presets: PresetDefinition[], messages: Messages) {
  return presets.map((preset) => ({
    ...preset,
    label: messages.presetLabel(preset.id),
    summary: messages.presetSummary(preset.id),
  }));
}

export function visibleEffectPresets(presets: PresetDefinition[]) {
  return presets.filter((preset) => preset.id !== "warmDim");
}

export function windowEffectTone(status: AppSnapshot["lens"]["status"]): StatusTone {
  switch (status) {
    case "attached":
      return "available";
    case "pending":
      return "neutral";
    case "suspended":
      return "available";
    case "detached":
      return "neutral";
  }
}

export function themeOptionsFor(messages: Messages) {
  return [
    { label: messages.themeLabel("system"), value: "system" },
    { label: messages.themeLabel("light"), value: "light" },
    { label: messages.themeLabel("dark"), value: "dark" },
    { label: messages.themeLabel("invert"), value: "invert" },
    { label: messages.themeLabel("greyscaleInvert"), value: "greyscaleInvert" },
  ];
}

export function runtimeEventTone(level: RuntimeEvent["level"]): StatusTone {
  switch (level) {
    case "error":
      return "unsupported";
    case "warn":
      return "experimental";
    case "trace":
    case "debug":
      return "planned";
    case "info":
      return "available";
  }
}
