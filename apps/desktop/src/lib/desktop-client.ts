import type { AppSnapshot, RuntimeEventLevel, ThemePreference, VisualPreset } from "./contracts";

const STORAGE_KEY = "glaremute:preview-snapshot";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

interface DesktopClient {
  attachWindow(windowId: string, preset: VisualPreset): Promise<AppSnapshot>;
  appendFrontendLog(level: RuntimeEventLevel, source: string, message: string): Promise<void>;
  bootstrapState(): Promise<AppSnapshot>;
  detachLens(): Promise<AppSnapshot>;
  getDebugReport(): Promise<string>;
  openLogsDirectory(): Promise<void>;
  refreshWindowCandidates(): Promise<AppSnapshot>;
  setThemePreference(theme: ThemePreference): Promise<AppSnapshot>;
  toggleSuspend(): Promise<AppSnapshot>;
}

export const desktopClient: DesktopClient = isTauriRuntime()
  ? {
      async attachWindow(windowId, preset) {
        const invoke = await loadInvoke();
        return invoke<AppSnapshot>("attach_window", { windowId, preset });
      },
      async appendFrontendLog(level, source, message) {
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
    async attachWindow(windowId, preset) {
      const snapshot = readSnapshot();
      const candidate = snapshot.windowCandidates.find((entry) => entry.windowId === windowId);

      if (!candidate) {
        throw new Error(`No mock window found for ${windowId}.`);
      }
      if (!["greyscaleInvert", "darken"].includes(preset)) {
        throw new Error(`${preset} is not available in the current build.`);
      }

      snapshot.lens = {
        activePreset: preset,
        activeTarget: candidate,
        backendLabel: "Mock transform backend",
        status: snapshot.diagnostics.suspended
          ? "suspended"
          : candidate.attachmentState === "minimized"
            ? "pending"
            : "attached",
        summary: mockLensSummary(
          preset,
          candidate.title,
          snapshot.diagnostics.suspended
            ? "suspended"
            : candidate.attachmentState === "minimized"
              ? "pending"
              : "attached"
        ),
      };
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message:
          candidate.attachmentState === "minimized"
            ? `applied ${preset} to ${candidate.title}; it will appear once the window is back on screen`
            : `applied ${preset} to ${candidate.title}`,
      });
      writeSnapshot(snapshot);
      return snapshot;
    },
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
    async detachLens() {
      const snapshot = readSnapshot();
      snapshot.lens = {
        activePreset: null,
        activeTarget: null,
        backendLabel: "Mock transform backend",
        status: "detached",
        summary: "No effect is active in the browser preview.",
      };
      snapshot.diagnostics.suspended = false;
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: "turned off the current mock effect",
      });
      writeSnapshot(snapshot);
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
    async refreshWindowCandidates() {
      const snapshot = readSnapshot();
      snapshot.windowCandidates = defaultWindowCandidates();
      if (snapshot.lens.activeTarget) {
        const nextTarget =
          snapshot.windowCandidates.find(
            (entry) => entry.windowId === snapshot.lens.activeTarget?.windowId
          ) ?? null;
        snapshot.lens.activeTarget = nextTarget;
        if (!snapshot.diagnostics.suspended && nextTarget) {
          snapshot.lens.status =
            nextTarget.attachmentState === "minimized" ? "pending" : "attached";
          snapshot.lens.summary = mockLensSummary(
            snapshot.lens.activePreset ?? "greyscaleInvert",
            nextTarget.title,
            snapshot.lens.status
          );
        }
      }
      writeSnapshot(snapshot);
      return snapshot;
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
      snapshot.lens.status =
        snapshot.diagnostics.suspended && snapshot.lens.activeTarget
          ? "suspended"
          : snapshot.lens.activeTarget
            ? snapshot.lens.activeTarget.attachmentState === "minimized"
              ? "pending"
              : "attached"
            : snapshot.diagnostics.suspended
              ? "suspended"
              : "detached";
      snapshot.lens.summary = snapshot.lens.activeTarget
        ? mockLensSummary(
            snapshot.lens.activePreset ?? "greyscaleInvert",
            snapshot.lens.activeTarget.title,
            snapshot.lens.status
          )
        : snapshot.diagnostics.suspended
          ? "The current effect is paused."
          : "No effect is active in the browser preview.";
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
    devMode: import.meta.env.DEV,
    settings: {
      themePreference: "system",
      panicHotkey: "Ctrl+Shift+F8",
      suspendOnStartup: false,
      profiles: [],
    },
    presets: [
      preset(
        "darken",
        "Darken",
        "transform",
        "A cooler dark treatment inspired by Windows dark surfaces."
      ),
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
          "experimental",
          "Browser preview simulates a live unified window list, including minimized windows that can be armed before restore."
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
          "available",
          "Mock preview keeps Darken and Greyscale Invert in the shared contract while native validation happens on Windows."
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
    lens: {
      activePreset: null,
      activeTarget: null,
      backendLabel: "Mock transform backend",
      status: "detached",
      summary: "No effect is active in the browser preview.",
    },
    windowCandidates: defaultWindowCandidates(),
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

function mockLensSummary(
  preset: VisualPreset,
  title: string,
  status: AppSnapshot["lens"]["status"]
) {
  const label =
    preset === "darken" ? "Darken" : preset === "warmDim" ? "Warm Dim" : "Greyscale Invert";

  switch (status) {
    case "pending":
      return `${label} will appear when ${title} is back on screen.`;
    case "attached":
      return `${label} is active on ${title}.`;
    case "suspended":
      return `${label} is paused for ${title}.`;
    case "detached":
      return "No effect is active in the browser preview.";
  }
}

function defaultWindowCandidates(): AppSnapshot["windowCandidates"] {
  return [
    {
      windowId: "0x00010001",
      title: "IRPF 2026 - Declaracao de Ajuste Anual",
      executablePath: "C:\\Program Files\\IRPF\\irpf.exe",
      processId: 4720,
      windowClass: "SunAwtFrame",
      bounds: { left: 128, top: 96, width: 1160, height: 820 },
      attachmentState: "available",
      isForeground: true,
    },
    {
      windowId: "0x00010002",
      title: "Bloco de Notas",
      executablePath: "C:\\Windows\\System32\\notepad.exe",
      processId: 8640,
      windowClass: "Notepad",
      bounds: { left: 1440, top: 128, width: 760, height: 640 },
      attachmentState: "minimized",
      isForeground: false,
    },
    {
      windowId: "0x00010003",
      title: "Explorador de Arquivos - Declaracoes 2026",
      executablePath: "C:\\Windows\\explorer.exe",
      processId: 3216,
      windowClass: "CabinetWClass",
      bounds: { left: 140, top: 120, width: 980, height: 700 },
      attachmentState: "available",
      isForeground: false,
    },
    {
      windowId: "0x00010004",
      title: "Visual Studio Code - glare-mute - App.tsx",
      executablePath: "C:\\Users\\dbhul\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
      processId: 7812,
      windowClass: "Chrome_WidgetWin_1",
      bounds: { left: 1180, top: 84, width: 1180, height: 860 },
      attachmentState: "available",
      isForeground: false,
    },
    {
      windowId: "0x00010005",
      title: "ReceitaNet BX - Importacao e recibos",
      executablePath: "C:\\Program Files\\Receita Federal\\ReceitaNet BX\\receitanetbx.exe",
      processId: 11028,
      windowClass: "SunAwtFrame",
      bounds: { left: 188, top: 158, width: 1024, height: 768 },
      attachmentState: "available",
      isForeground: false,
    },
    {
      windowId: "0x00010006",
      title: "Painel de Controle > Sistema e Seguranca > Opcoes de Energia",
      executablePath: "C:\\Windows\\System32\\control.exe",
      processId: 9188,
      windowClass: "CabinetWClass",
      bounds: { left: 1268, top: 196, width: 900, height: 694 },
      attachmentState: "minimized",
      isForeground: false,
    },
    {
      windowId: "0x00010007",
      title: "Mozilla Firefox - Documentacao de acessibilidade e contraste visual",
      executablePath: "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
      processId: 13124,
      windowClass: "MozillaWindowClass",
      bounds: { left: 78, top: 72, width: 1360, height: 890 },
      attachmentState: "available",
      isForeground: false,
    },
    {
      windowId: "0x00010008",
      title: "LibreOffice Calc - Planejamento financeiro 2026.ods",
      executablePath: "C:\\Program Files\\LibreOffice\\program\\scalc.exe",
      processId: 14448,
      windowClass: "SALFRAME",
      bounds: { left: 320, top: 188, width: 1280, height: 760 },
      attachmentState: "available",
      isForeground: false,
    },
  ];
}
