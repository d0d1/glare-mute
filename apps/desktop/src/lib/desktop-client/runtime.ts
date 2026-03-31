import type {
  AppLanguage,
  AppSnapshot,
  RuntimeEventLevel,
  ThemePreference,
  VisualPreset,
} from "../contracts";
import type { DesktopClient } from "./types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriRuntime() {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__ !== "undefined";
}

async function loadInvoke() {
  const module = await import("@tauri-apps/api/core");
  return module.invoke;
}

export function createTauriDesktopClient(): DesktopClient {
  return {
    async attachWindow(windowId: string, preset: VisualPreset) {
      const invoke = await loadInvoke();
      return invoke<AppSnapshot>("attach_window", { windowId, preset });
    },
    async appendFrontendLog(level: RuntimeEventLevel, source: string, message: string) {
      const invoke = await loadInvoke();
      return invoke("append_frontend_log", { level, source, message });
    },
    async bootstrapState() {
      const invoke = await loadInvoke();
      return invoke<AppSnapshot>("bootstrap_state");
    },
    async detachLens() {
      const invoke = await loadInvoke();
      return invoke<AppSnapshot>("detach_lens");
    },
    async getDebugReport() {
      const invoke = await loadInvoke();
      return invoke<string>("get_debug_report");
    },
    async openLogsDirectory() {
      const invoke = await loadInvoke();
      return invoke("open_logs_directory");
    },
    async refreshWindowCandidates() {
      const invoke = await loadInvoke();
      return invoke<AppSnapshot>("refresh_window_candidates");
    },
    async setApplyToRelatedWindows(enabled: boolean) {
      const invoke = await loadInvoke();
      return invoke<AppSnapshot>("set_apply_to_related_windows", { enabled });
    },
    async setLanguage(language: AppLanguage) {
      const invoke = await loadInvoke();
      return invoke<AppSnapshot>("set_language", { language });
    },
    async setThemePreference(theme: ThemePreference) {
      const invoke = await loadInvoke();
      return invoke<AppSnapshot>("set_theme_preference", { theme });
    },
  };
}
