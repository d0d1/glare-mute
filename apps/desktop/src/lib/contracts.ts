export type AppLanguage = "system" | "en" | "pt-BR" | "es" | "fr" | "zh-Hans" | "hi" | "ar" | "bn";
export type ThemePreference = "system" | "light" | "dark" | "invert" | "greyscaleInvert";
export type EffectFamily = "tint" | "transform";
export type VisualPreset = "warmDim" | "invert" | "greyscaleInvert";
export type CapabilityStatus = "available" | "experimental" | "planned" | "unsupported";
export type RuntimeEventLevel = "trace" | "debug" | "info" | "warn" | "error";
export type LensStatus = "detached" | "pending" | "attached" | "suspended";
export type WindowAttachmentState = "available" | "minimized";

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
  language: AppLanguage;
  themePreference: ThemePreference;
  applyToRelatedWindows: boolean;
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
  logicalTargetId: string;
  secondaryLabel: string | null;
  title: string;
  executablePath: string | null;
  processId: number;
  windowClass: string | null;
  bounds: WindowBounds;
  attachmentState: WindowAttachmentState;
  isForeground: boolean;
}

export interface LensSnapshot {
  status: LensStatus;
  activePreset: VisualPreset | null;
  activeTarget: WindowDescriptor | null;
  coveredTargets: WindowDescriptor[];
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
