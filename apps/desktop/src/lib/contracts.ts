export type ThemePreference = "system" | "light" | "dark";
export type EffectFamily = "tint" | "transform";
export type VisualPreset = "darken" | "warmDim" | "greyscaleInvert";
export type CapabilityStatus = "available" | "experimental" | "planned" | "unsupported";
export type RuntimeEventLevel = "trace" | "debug" | "info" | "warn" | "error";
export type LensStatus = "detached" | "attached" | "suspended";

export interface PresetDefinition {
  id: VisualPreset;
  label: string;
  family: EffectFamily;
  summary: string;
}

export interface CapabilityDescriptor {
  id: string;
  label: string;
  status: CapabilityStatus;
  summary: string;
}

export interface ProfileRule {
  executablePath: string;
  preset: VisualPreset;
  titlePattern: string | null;
  windowClass: string | null;
  notes: string | null;
}

export interface AppSettings {
  themePreference: ThemePreference;
  panicHotkey: string;
  suspendOnStartup: boolean;
  profiles: ProfileRule[];
}

export interface RuntimeEvent {
  timestamp: string;
  level: RuntimeEventLevel;
  source: string;
  message: string;
}

export interface RuntimeDiagnostics {
  suspended: boolean;
  settingsFile: string;
  logFile: string;
  recentEvents: RuntimeEvent[];
}

export interface PlatformSummary {
  os: string;
  target: string;
  backendId: string;
  backendLabel: string;
  webviewVersion: string | null;
  capabilities: CapabilityDescriptor[];
}

export interface WindowBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface WindowDescriptor {
  windowId: string;
  title: string;
  executablePath: string | null;
  processId: number;
  windowClass: string | null;
  bounds: WindowBounds;
  isForeground: boolean;
}

export interface LensSnapshot {
  status: LensStatus;
  activePreset: VisualPreset | null;
  activeTarget: WindowDescriptor | null;
  summary: string;
  backendLabel: string;
}

export interface AppSnapshot {
  appName: string;
  appVersion: string;
  devMode: boolean;
  settings: AppSettings;
  presets: PresetDefinition[];
  diagnostics: RuntimeDiagnostics;
  platform: PlatformSummary;
  lens: LensSnapshot;
  windowCandidates: WindowDescriptor[];
}
