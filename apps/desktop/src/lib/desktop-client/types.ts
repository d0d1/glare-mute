import type {
  AppLanguage,
  AppSnapshot,
  RuntimeEventLevel,
  ThemePreference,
  VisualPreset,
} from "../contracts";

export interface DesktopClient {
  appendFrontendLog(level: RuntimeEventLevel, source: string, message: string): Promise<void>;
  bootstrapState(): Promise<AppSnapshot>;
  getDebugReport(): Promise<string>;
  openLogsDirectory(): Promise<void>;
  refreshWindowCandidates(): Promise<AppSnapshot>;
  removeProfile(profileId: string): Promise<AppSnapshot>;
  saveProfileFromWindow(windowId: string, preset: VisualPreset): Promise<AppSnapshot>;
  setApplyToRelatedWindows(enabled: boolean): Promise<AppSnapshot>;
  setLanguage(language: AppLanguage): Promise<AppSnapshot>;
  setProfileEnabled(profileId: string, enabled: boolean): Promise<AppSnapshot>;
  setThemePreference(theme: ThemePreference): Promise<AppSnapshot>;
}
