import type {
  AppLanguage,
  LensStatus,
  ThemePreference,
  VisualPreset,
  WindowAttachmentState,
} from "../contracts";

export const PRODUCT_NAME = "Glare mute";

export type ResolvedLanguage = Exclude<AppLanguage, "system">;

export interface Messages {
  advancedDetails: string;
  appSubtitle: string;
  application: string;
  applied: string;
  applying: string;
  availableWindows: string;
  backend: string;
  bounds: string;
  chooseEffect: string;
  chooseWindow: string;
  copyDebugReport: string;
  copyDebugReportFailure: string;
  copied: string;
  copying: string;
  disable: string;
  enable: string;
  effect: string;
  effectHintDetached: string;
  executablePath: string;
  executableUnavailable: string;
  filterWindows: string;
  filterWindowsPlaceholder: string;
  language: string;
  loadingMessage: string;
  logFile: string;
  logs: string;
  minimized: string;
  noWindowsAvailable: string;
  noWindowsMatch: string;
  off: string;
  on: string;
  openLogs: string;
  openLogsFailure: string;
  openProductFailure: string;
  opening: string;
  pending: string;
  process: string;
  refreshWindowListFailure: string;
  recentEvents: (count: number) => string;
  recentEventsSubtitle: string;
  relatedWindows: string;
  relatedWindowsDescription: string;
  remove: string;
  runtime: string;
  runtimeSubtitle: string;
  selectWindowToContinue: string;
  saveForApp: string;
  savedApps: string;
  savedAppsEmpty: string;
  selectedWindow: string;
  selectedWindowEmpty: string;
  settings: string;
  settingsFile: string;
  state: string;
  supportDiagnostics: string;
  system: string;
  theme: string;
  title: string;
  turningOff: string;
  turnOff: string;
  unexpectedBridgeError: string;
  unavailable: string;
  windowCount: string;
  windowId: string;
  windowClass: string;
  windowsMatch: (count: number) => string;
  windowsShown: (count: number) => string;
  effectSummary: (args: {
    coveredCount: number;
    enabledProfileCount: number;
    status: LensStatus;
    visibleCount: number;
  }) => string;
  saveProfileButton: (args: {
    busy: boolean;
    hasPreset: boolean;
    hasSavedProfile: boolean;
    hasSelectedWindow: boolean;
    presetLabel: string | null;
  }) => string;
  saveProfileHint: (args: {
    attachmentState: WindowAttachmentState | null;
    hasSavedProfile: boolean;
  }) => string;
  presetLabel: (preset: VisualPreset) => string;
  presetSummary: (preset: VisualPreset) => string;
  savedAppsSubtitle: (count: number) => string;
  savedProfileSummary: (args: {
    enabled: boolean;
    matchCount: number;
    presetLabel: string;
    visibleCount: number;
  }) => string;
  themeLabel: (theme: ThemePreference) => string;
  windowEffectLabel: (status: LensStatus) => string;
  windowState: (state: WindowAttachmentState) => string;
}
