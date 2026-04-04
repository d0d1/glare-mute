import type { AppSnapshot, VisualPreset } from "../contracts";

export function defaultSnapshot(): AppSnapshot {
  return {
    appName: "Glare mute",
    appVersion: "0.1.2-preview",
    devMode: import.meta.env.DEV,
    settings: {
      language: "system",
      themePreference: "system",
      applyToRelatedWindows: true,
      suspendOnStartup: false,
      profiles: [],
    },
    presets: [
      preset("invert", "Invert", "transform", "A full-color invert that preserves color cues."),
      preset("warmDim", "Warm Dim", "tint", "A warmer amber tint for bright interfaces."),
      preset(
        "greyscaleInvert",
        "Greyscale Invert",
        "transform",
        "A greyscale invert for light interfaces that ignore dark mode."
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

export function defaultWindowCandidates(): AppSnapshot["windowCandidates"] {
  return [
    {
      windowId: "0x00010001",
      logicalTargetId: "0x00010001",
      secondaryLabel: null,
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
      logicalTargetId: "0x00010002",
      secondaryLabel: null,
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
      logicalTargetId: "0x00010003",
      secondaryLabel: null,
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
      logicalTargetId: "0x00010004",
      secondaryLabel: null,
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
      logicalTargetId: "0x00010005",
      secondaryLabel: null,
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
      logicalTargetId: "0x00010006",
      secondaryLabel: null,
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
      logicalTargetId: "0x00010007",
      secondaryLabel: null,
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
      logicalTargetId: "0x00010008",
      secondaryLabel: null,
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
      logicalTargetId: "0x00010009",
      secondaryLabel: null,
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
