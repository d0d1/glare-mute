import type {
  AppLanguage,
  AppSnapshot,
  RuntimeEventLevel,
  ThemePreference,
  VisualPreset,
} from "../contracts";

export interface DesktopClient {
  attachWindow(windowId: string, preset: VisualPreset): Promise<AppSnapshot>;
  appendFrontendLog(level: RuntimeEventLevel, source: string, message: string): Promise<void>;
  bootstrapState(): Promise<AppSnapshot>;
  detachLens(): Promise<AppSnapshot>;
  getDebugReport(): Promise<string>;
  openLogsDirectory(): Promise<void>;
  refreshWindowCandidates(): Promise<AppSnapshot>;
  setApplyToRelatedWindows(enabled: boolean): Promise<AppSnapshot>;
  setLanguage(language: AppLanguage): Promise<AppSnapshot>;
  setThemePreference(theme: ThemePreference): Promise<AppSnapshot>;
}
