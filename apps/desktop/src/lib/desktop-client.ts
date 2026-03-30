import type { AppSnapshot, RuntimeEventLevel, ThemePreference, VisualPreset } from "./contracts";

const STORAGE_KEY = "glaremute:preview-snapshot";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

interface DesktopClient {
  appendFrontendLog(level: RuntimeEventLevel, source: string, message: string): Promise<void>;
  bootstrapState(): Promise<AppSnapshot>;
  getDebugReport(): Promise<string>;
  openLogsDirectory(): Promise<void>;
  setThemePreference(theme: ThemePreference): Promise<AppSnapshot>;
  toggleSuspend(): Promise<AppSnapshot>;
}

export const desktopClient: DesktopClient = isTauriRuntime()
  ? {
      async appendFrontendLog(level, source, message) {
        const invoke = await loadInvoke();
        return invoke("append_frontend_log", { level, source, message });
      },
      async bootstrapState() {
        const invoke = await loadInvoke();
        return invoke<AppSnapshot>("bootstrap_state");
      },
      async getDebugReport() {
        const invoke = await loadInvoke();
        return invoke<string>("get_debug_report");
      },
      async openLogsDirectory() {
        const invoke = await loadInvoke();
        return invoke("open_logs_directory");
      },
      async setThemePreference(theme) {
        const invoke = await loadInvoke();
        return invoke<AppSnapshot>("set_theme_preference", { theme });
      },
      async toggleSuspend() {
        const invoke = await loadInvoke();
        return invoke<AppSnapshot>("toggle_suspend");
      },
    }
  : createMockDesktopClient();

export function __resetMockDesktopClient() {
  localStorage.removeItem(STORAGE_KEY);
}

function isTauriRuntime() {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__ !== "undefined";
}

async function loadInvoke() {
  const module = await import("@tauri-apps/api/core");
  return module.invoke;
}

function createMockDesktopClient(): DesktopClient {
  return {
    async appendFrontendLog(level, source, message) {
      const snapshot = readSnapshot();
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level,
        source,
        message,
      });
      snapshot.diagnostics.recentEvents = snapshot.diagnostics.recentEvents.slice(0, 24);
      writeSnapshot(snapshot);
    },
    async bootstrapState() {
      const snapshot = readSnapshot();
      if (snapshot.diagnostics.recentEvents.length === 0) {
        snapshot.diagnostics.recentEvents.push({
          timestamp: new Date().toISOString(),
          level: "info",
          source: "mock-runtime",
          message: "browser preview booted with the shared desktop contract",
        });
        writeSnapshot(snapshot);
      }

      return snapshot;
    },
    async getDebugReport() {
      return JSON.stringify(readSnapshot(), null, 2);
    },
    async openLogsDirectory() {
      const snapshot = readSnapshot();
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: "log directory open request ignored in browser preview",
      });
      writeSnapshot(snapshot);
    },
    async setThemePreference(theme) {
      const snapshot = readSnapshot();
      snapshot.settings.themePreference = theme;
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: `theme preference updated to ${theme}`,
      });
      writeSnapshot(snapshot);
      return snapshot;
    },
    async toggleSuspend() {
      const snapshot = readSnapshot();
      snapshot.diagnostics.suspended = !snapshot.diagnostics.suspended;
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: snapshot.diagnostics.suspended ? "lens output suspended" : "lens output resumed",
      });
      writeSnapshot(snapshot);
      return snapshot;
    },
  };
}

function readSnapshot(): AppSnapshot {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored) as AppSnapshot;
  }

  const snapshot = defaultSnapshot();
  writeSnapshot(snapshot);
  return snapshot;
}

function writeSnapshot(snapshot: AppSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function defaultSnapshot(): AppSnapshot {
  return {
    appName: "GlareMute",
    appVersion: "0.1.0-preview",
    devMode: true,
    settings: {
      themePreference: "system",
      panicHotkey: "Ctrl+Shift+Pause",
      suspendOnStartup: false,
      profiles: [],
    },
    presets: [
      preset("darken", "Darken", "tint", "A neutral dim layer that keeps text crisp."),
      preset("warmDim", "Warm Dim", "tint", "An amber-forward dim preset tuned for glare."),
      preset(
        "greyscaleInvert",
        "Greyscale Invert",
        "transform",
        "The transform path for harsh apps that ignore every other theme signal."
      ),
    ],
    diagnostics: {
      suspended: false,
      settingsFile: "browser-preview://settings.json",
      logFile: "browser-preview://glare-mute.log",
      recentEvents: [],
    },
    platform: {
      os: "browser",
      target: "playwright-preview",
      backendId: "browser-preview",
      backendLabel: "Browser Preview",
      webviewVersion: null,
      capabilities: [
        capability(
          "windowPicker",
          "Window picker",
          "unsupported",
          "Browser preview intentionally disables native window attachment."
        ),
        capability(
          "tintBackend",
          "Tint backend",
          "planned",
          "The preview surface models the zero-lag tint path but does not draw over native windows."
        ),
        capability(
          "magnificationBackend",
          "Magnification transform",
          "experimental",
          "The product plan still spikes the Magnification API early before promoting it."
        ),
        capability(
          "captureBackend",
          "Graphics Capture transform",
          "planned",
          "Capture-plus-shader remains a first-class candidate for invert-style presets."
        ),
        capability(
          "popupTracking",
          "Popup tracking",
          "planned",
          "Main-window coverage is the release bar; popup coverage follows later."
        ),
      ],
    },
  };
}

function capability(
  id: string,
  label: string,
  status: AppSnapshot["platform"]["capabilities"][number]["status"],
  summary: string
) {
  return { id, label, status, summary };
}

function preset(
  id: VisualPreset,
  label: string,
  family: AppSnapshot["presets"][number]["family"],
  summary: string
) {
  return { id, label, family, summary };
}
