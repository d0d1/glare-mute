import type {
  AppLanguage,
  AppSnapshot,
  RuntimeEventLevel,
  ThemePreference,
  VisualPreset,
  WindowDescriptor,
} from "./contracts";

const STORAGE_KEY = "glaremute:preview-snapshot";
type LegacyVisualPreset = VisualPreset | "dark" | "darken";

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
  setApplyToRelatedWindows(enabled: boolean): Promise<AppSnapshot>;
  setLanguage(language: AppLanguage): Promise<AppSnapshot>;
  setThemePreference(theme: ThemePreference): Promise<AppSnapshot>;
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
      async setApplyToRelatedWindows(enabled) {
        const invoke = await loadInvoke();
        return invoke<AppSnapshot>("set_apply_to_related_windows", { enabled });
      },
      async setLanguage(language) {
        const invoke = await loadInvoke();
        return invoke<AppSnapshot>("set_language", { language });
      },
      async setThemePreference(theme) {
        const invoke = await loadInvoke();
        return invoke<AppSnapshot>("set_theme_preference", { theme });
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
      if (!["greyscaleInvert", "invert"].includes(preset)) {
        throw new Error(`${preset} is not available in the current build.`);
      }

      const coveredTargets = relatedWindowTargets(snapshot, candidate);
      const status = mockLensStatus(coveredTargets);
      snapshot.lens = {
        activePreset: preset,
        activeTarget: candidate,
        coveredTargets,
        backendLabel: "Mock transform backend",
        status,
        summary: mockLensSummary(preset, candidate, coveredTargets, status),
      };
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message:
          status === "pending"
            ? `applied ${preset} to ${candidate.title}; it will appear once the window is back on screen`
            : snapshot.settings.applyToRelatedWindows && coveredTargets.length > 1
              ? `applied ${preset} to ${coveredTargets.length} windows from the same app`
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
        coveredTargets: [],
        backendLabel: "Mock transform backend",
        status: "detached",
        summary: "No effect is active in the browser preview.",
      };
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
          ) ??
          snapshot.windowCandidates.find(
            (entry) => entry.processId === snapshot.lens.activeTarget?.processId
          ) ??
          null;
        snapshot.lens.activeTarget = nextTarget;
        if (nextTarget) {
          const coveredTargets = relatedWindowTargets(snapshot, nextTarget);
          const status = mockLensStatus(coveredTargets);
          snapshot.lens.coveredTargets = coveredTargets;
          snapshot.lens.status = status;
          snapshot.lens.summary = mockLensSummary(
            snapshot.lens.activePreset ?? "invert",
            nextTarget,
            coveredTargets,
            status
          );
        } else {
          snapshot.lens = {
            activePreset: null,
            activeTarget: null,
            coveredTargets: [],
            backendLabel: snapshot.lens.backendLabel,
            status: "detached",
            summary: "No effect is active in the browser preview.",
          };
        }
      }
      writeSnapshot(snapshot);
      return snapshot;
    },
    async setApplyToRelatedWindows(enabled) {
      const snapshot = readSnapshot();
      snapshot.settings.applyToRelatedWindows = enabled;
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: enabled ? "related window coverage enabled" : "related window coverage disabled",
      });
      if (snapshot.lens.activeTarget) {
        const coveredTargets = relatedWindowTargets(snapshot, snapshot.lens.activeTarget);
        const status = mockLensStatus(coveredTargets);
        snapshot.lens.coveredTargets = coveredTargets;
        snapshot.lens.status = status;
        snapshot.lens.summary = mockLensSummary(
          snapshot.lens.activePreset ?? "invert",
          snapshot.lens.activeTarget,
          coveredTargets,
          status
        );
      }
      writeSnapshot(snapshot);
      return snapshot;
    },
    async setLanguage(language) {
      const snapshot = readSnapshot();
      snapshot.settings.language = language;
      snapshot.diagnostics.recentEvents.unshift({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "mock-runtime",
        message: `language updated to ${language}`,
      });
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
  };
}

function readSnapshot(): AppSnapshot {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const snapshot = normalizeSnapshot(JSON.parse(stored) as AppSnapshot);
    writeSnapshot(snapshot);
    return snapshot;
  }

  const snapshot = defaultSnapshot();
  writeSnapshot(snapshot);
  return snapshot;
}

function writeSnapshot(snapshot: AppSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function normalizeSnapshot(snapshot: AppSnapshot): AppSnapshot {
  return {
    ...snapshot,
    presets: snapshot.presets.map((preset) => ({
      ...preset,
      id: normalizePersistedPresetId(preset.id),
      label: normalizePersistedPresetId(preset.id) === "invert" ? "Invert" : preset.label,
    })),
    settings: {
      ...snapshot.settings,
      language:
        (snapshot.settings as AppSnapshot["settings"] & { language?: AppLanguage }).language ??
        "system",
      applyToRelatedWindows:
        (snapshot.settings as AppSnapshot["settings"] & { applyToRelatedWindows?: boolean })
          .applyToRelatedWindows ?? true,
      profiles: snapshot.settings.profiles.map((profile) => ({
        ...profile,
        preset: normalizePersistedPresetId(profile.preset),
      })),
    },
    lens: {
      ...snapshot.lens,
      activePreset: normalizeOptionalPresetId(snapshot.lens.activePreset),
      coveredTargets:
        (snapshot.lens as AppSnapshot["lens"] & { coveredTargets?: WindowDescriptor[] })
          .coveredTargets ?? (snapshot.lens.activeTarget ? [snapshot.lens.activeTarget] : []),
    },
  };
}

function normalizePersistedPresetId(preset: LegacyVisualPreset): VisualPreset {
  if (preset === "dark" || preset === "darken") {
    return "greyscaleInvert";
  }

  return preset;
}

function normalizeOptionalPresetId(preset: LegacyVisualPreset | null): VisualPreset | null {
  return preset === null ? null : normalizePersistedPresetId(preset);
}

function defaultSnapshot(): AppSnapshot {
  return {
    appName: "Glare mute",
    appVersion: "0.1.0-preview",
    devMode: import.meta.env.DEV,
    settings: {
      language: "system",
      themePreference: "system",
      applyToRelatedWindows: true,
      suspendOnStartup: false,
      profiles: [],
    },
    presets: [
      preset("invert", "Invert", "transform", "A full-color invert that preserves non-grey cues."),
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
          "Browser preview simulates a live unified window list, including minimized windows that can be armed before restore and related windows from the same running app."
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
          "Mock preview keeps Invert and Greyscale Invert in the shared contract while native validation happens on Windows, including related-window coverage in the shared session model."
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
      coveredTargets: [],
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
  activeTarget: AppSnapshot["lens"]["activeTarget"],
  coveredTargets: AppSnapshot["lens"]["coveredTargets"],
  status: AppSnapshot["lens"]["status"]
) {
  const label =
    preset === "invert" ? "Invert" : preset === "warmDim" ? "Warm Dim" : "Greyscale Invert";
  const visibleCount = coveredTargets.filter(
    (target) => target.attachmentState === "available"
  ).length;
  const coveredCount = coveredTargets.length;

  switch (status) {
    case "pending":
      return coveredCount > 1
        ? `${label} will appear when the selected app is back on screen.`
        : `${label} will appear when ${activeTarget?.title ?? "the selected window"} is back on screen.`;
    case "attached":
      return coveredCount > 1
        ? `${label} is active on ${Math.max(visibleCount, 1)} windows from the same app.`
        : `${label} is active on ${activeTarget?.title ?? "the selected window"}.`;
    case "suspended":
      return "The current effect is paused in the browser preview.";
    case "detached":
      return "No effect is active in the browser preview.";
  }
}

function mockLensStatus(
  coveredTargets: AppSnapshot["lens"]["coveredTargets"]
): AppSnapshot["lens"]["status"] {
  if (coveredTargets.length === 0) {
    return "detached";
  }

  return coveredTargets.some((target) => target.attachmentState === "available")
    ? "attached"
    : "pending";
}

function relatedWindowTargets(
  snapshot: AppSnapshot,
  candidate: WindowDescriptor
): AppSnapshot["lens"]["coveredTargets"] {
  return snapshot.settings.applyToRelatedWindows
    ? snapshot.windowCandidates.filter((entry) => entry.processId === candidate.processId)
    : [candidate];
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
      title: "IRPF 2026 - Rendimentos Tributaveis Recebidos de Pessoa Juridica",
      executablePath: "C:\\Program Files\\IRPF\\irpf.exe",
      processId: 4720,
      windowClass: "SunAwtDialog",
      bounds: { left: 284, top: 156, width: 980, height: 702 },
      attachmentState: "available",
      isForeground: false,
    },
    {
      windowId: "0x00010003",
      title: "Bloco de Notas",
      executablePath: "C:\\Windows\\System32\\notepad.exe",
      processId: 8640,
      windowClass: "Notepad",
      bounds: { left: 1440, top: 128, width: 760, height: 640 },
      attachmentState: "minimized",
      isForeground: false,
    },
    {
      windowId: "0x00010004",
      title: "Explorador de Arquivos - Declaracoes 2026",
      executablePath: "C:\\Windows\\explorer.exe",
      processId: 3216,
      windowClass: "CabinetWClass",
      bounds: { left: 140, top: 120, width: 980, height: 700 },
      attachmentState: "available",
      isForeground: false,
    },
    {
      windowId: "0x00010005",
      title: "Visual Studio Code - glare-mute - App.tsx",
      executablePath: "C:\\Users\\dbhul\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
      processId: 7812,
      windowClass: "Chrome_WidgetWin_1",
      bounds: { left: 1180, top: 84, width: 1180, height: 860 },
      attachmentState: "available",
      isForeground: false,
    },
    {
      windowId: "0x00010006",
      title: "ReceitaNet BX - Importacao e recibos",
      executablePath: "C:\\Program Files\\Receita Federal\\ReceitaNet BX\\receitanetbx.exe",
      processId: 11028,
      windowClass: "SunAwtFrame",
      bounds: { left: 188, top: 158, width: 1024, height: 768 },
      attachmentState: "available",
      isForeground: false,
    },
    {
      windowId: "0x00010007",
      title: "Painel de Controle > Sistema e Seguranca > Opcoes de Energia",
      executablePath: "C:\\Windows\\System32\\control.exe",
      processId: 9188,
      windowClass: "CabinetWClass",
      bounds: { left: 1268, top: 196, width: 900, height: 694 },
      attachmentState: "minimized",
      isForeground: false,
    },
    {
      windowId: "0x00010008",
      title: "Mozilla Firefox - Documentacao de acessibilidade e contraste visual",
      executablePath: "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
      processId: 13124,
      windowClass: "MozillaWindowClass",
      bounds: { left: 78, top: 72, width: 1360, height: 890 },
      attachmentState: "available",
      isForeground: false,
    },
    {
      windowId: "0x00010009",
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
