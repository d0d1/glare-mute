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
  runtime: string;
  runtimeSubtitle: string;
  selectWindowToContinue: string;
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
    presetLabel: string;
    status: LensStatus;
    targetTitle: string | null;
    visibleCount: number;
  }) => string;
  applyButton: (args: {
    busy: boolean;
    hasPreset: boolean;
    hasSelectedWindow: boolean;
    presetLabel: string | null;
  }) => string;
  applyHint: (attachmentState: WindowAttachmentState | null) => string;
  presetLabel: (preset: VisualPreset) => string;
  presetSummary: (preset: VisualPreset) => string;
  themeLabel: (theme: ThemePreference) => string;
  windowEffectLabel: (status: LensStatus) => string;
  windowState: (state: WindowAttachmentState) => string;
}
