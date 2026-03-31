import type {
  AppLanguage,
  LensStatus,
  ThemePreference,
  VisualPreset,
  WindowAttachmentState,
} from "./contracts";

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

const LOCALE_TAG: Record<ResolvedLanguage, string> = {
  en: "en-US",
  "pt-BR": "pt-BR",
  es: "es-ES",
};

export function resolveEffectiveLanguage(language: AppLanguage): ResolvedLanguage {
  if (language !== "system") {
    return language;
  }

  if (typeof navigator === "undefined") {
    return "en";
  }

  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();

    if (normalized.startsWith("pt-br") || normalized.startsWith("pt")) {
      return "pt-BR";
    }

    if (normalized.startsWith("es")) {
      return "es";
    }

    if (normalized.startsWith("en")) {
      return "en";
    }
  }

  return "en";
}

export function languageOptions(messages: Messages): Array<{ label: string; value: AppLanguage }> {
  return [
    { label: messages.system, value: "system" },
    { label: "English", value: "en" },
    { label: "Português (Brasil)", value: "pt-BR" },
    { label: "Español", value: "es" },
  ];
}

export function getMessages(language: ResolvedLanguage): Messages {
  const number = new Intl.NumberFormat(LOCALE_TAG[language]);
  const formatCount = (count: number) => number.format(count);

  const base = {
    effectSummary: ({
      coveredCount,
      presetLabel,
      status,
      targetTitle,
      visibleCount,
    }: {
      coveredCount: number;
      presetLabel: string;
      status: LensStatus;
      targetTitle: string | null;
      visibleCount: number;
    }) => {
      switch (status) {
        case "pending":
          return coveredCount > 1
            ? pendingMany(language, presetLabel)
            : pendingOne(language, presetLabel, targetTitle);
        case "attached":
          return coveredCount > 1
            ? appliedMany(language, presetLabel, Math.max(visibleCount, 1), formatCount)
            : appliedOne(language, presetLabel, targetTitle);
        case "suspended":
        case "detached":
          return detachedEffectMessage(language);
      }
    },
    applyButton: ({
      busy,
      hasPreset,
      hasSelectedWindow,
      presetLabel,
    }: {
      busy: boolean;
      hasPreset: boolean;
      hasSelectedWindow: boolean;
      presetLabel: string | null;
    }) => {
      if (busy) {
        return getApplying(language);
      }

      if (!hasSelectedWindow) {
        return getChooseWindow(language);
      }

      if (!hasPreset || !presetLabel) {
        return getChooseEffect(language);
      }

      return getApplyPreset(language, presetLabel);
    },
    applyHint: (attachmentState: WindowAttachmentState | null) => {
      if (!attachmentState) {
        return getSelectWindowToContinue(language);
      }

      if (attachmentState === "minimized") {
        return getApplyHintMinimized(language);
      }

      return getApplyHintReady(language);
    },
    presetLabel: (preset: VisualPreset) => getPresetLabel(language, preset),
    presetSummary: (preset: VisualPreset) => getPresetSummary(language, preset),
    themeLabel: (theme: ThemePreference) => getThemeLabel(language, theme),
    windowEffectLabel: (status: LensStatus) => getWindowEffectLabel(language, status),
    windowState: (state: WindowAttachmentState) => getWindowState(language, state),
  } satisfies Pick<
    Messages,
    | "effectSummary"
    | "applyButton"
    | "applyHint"
    | "presetLabel"
    | "presetSummary"
    | "themeLabel"
    | "windowEffectLabel"
    | "windowState"
  >;

  switch (language) {
    case "pt-BR":
      return {
        ...base,
        advancedDetails: "Detalhes avançados",
        appSubtitle:
          "Escolha uma janela e aplique um efeito sem mudar o resto da área de trabalho.",
        application: "Aplicativo",
        applied: "Aplicado",
        applying: "Aplicando…",
        availableWindows: "Janelas disponíveis",
        backend: "Backend",
        bounds: "Limites",
        chooseEffect: "Escolha um efeito",
        chooseWindow: "Escolha uma janela",
        copyDebugReport: "Copiar relatório de depuração",
        copyDebugReportFailure: "Falha ao copiar o relatório de depuração.",
        copied: "Copiado",
        copying: "Copiando…",
        effect: "Efeito",
        effectHintDetached: "Escolha como a janela selecionada deve ficar.",
        executablePath: "Caminho do executável",
        executableUnavailable: "Executável indisponível",
        filterWindows: "Filtrar janelas",
        filterWindowsPlaceholder: "Filtrar por título ou aplicativo",
        language: "Idioma",
        loadingMessage: "Abrindo o espaço de trabalho e carregando a lista atual de janelas.",
        logFile: "Arquivo de log",
        logs: "Logs",
        minimized: "Minimizada",
        noWindowsAvailable:
          "Nenhuma janela está disponível ainda. Traga o aplicativo alvo para a área de trabalho e aguarde um instante.",
        noWindowsMatch: "Nenhuma janela corresponde ao filtro atual.",
        off: "Desligado",
        openLogs: "Abrir logs",
        openLogsFailure: "Falha ao abrir o diretório de logs.",
        openProductFailure: `Falha ao abrir ${PRODUCT_NAME}.`,
        opening: "Abrindo…",
        pending: "Pendente",
        process: "Processo",
        refreshWindowListFailure: "Falha ao atualizar a lista de janelas.",
        recentEvents: (count) => `Eventos recentes (${formatCount(count)})`,
        recentEventsSubtitle: "Mais novos primeiro.",
        relatedWindows: "Aplicar às janelas relacionadas",
        relatedWindowsDescription:
          "Mantenha automaticamente o efeito em novas janelas do mesmo aplicativo quando possível.",
        runtime: "Tempo de execução",
        runtimeSubtitle: "Detalhes locais do tempo de execução.",
        selectWindowToContinue: "Selecione uma janela para continuar.",
        selectedWindow: "Janela selecionada",
        selectedWindowEmpty: "Selecione uma janela na lista para escolher onde o efeito deve ir.",
        settings: "Configurações",
        settingsFile: "Arquivo de configurações",
        state: "Estado",
        supportDiagnostics: "Suporte e diagnósticos",
        system: "Sistema",
        theme: "Tema",
        title: "Título",
        turningOff: "Desligando…",
        turnOff: "Desligar",
        unexpectedBridgeError: "Erro inesperado da ponte do desktop.",
        unavailable: "Indisponível",
        windowCount: "Quantidade de janelas",
        windowId: "ID da janela",
        windowClass: "Classe da janela",
        windowsMatch: (count) => `${formatCount(count)} janelas correspondem.`,
        windowsShown: (count) =>
          `${formatCount(count)} janelas exibidas. Atualiza automaticamente.`,
      };
    case "es":
      return {
        ...base,
        advancedDetails: "Detalles avanzados",
        appSubtitle: "Elige una ventana y aplica un efecto sin cambiar el resto del escritorio.",
        application: "Aplicación",
        applied: "Aplicado",
        applying: "Aplicando…",
        availableWindows: "Ventanas disponibles",
        backend: "Backend",
        bounds: "Límites",
        chooseEffect: "Elige un efecto",
        chooseWindow: "Elige una ventana",
        copyDebugReport: "Copiar informe de depuración",
        copyDebugReportFailure: "No se pudo copiar el informe de depuración.",
        copied: "Copiado",
        copying: "Copiando…",
        effect: "Efecto",
        effectHintDetached: "Elige cómo debe verse la ventana seleccionada.",
        executablePath: "Ruta del ejecutable",
        executableUnavailable: "Ejecutable no disponible",
        filterWindows: "Filtrar ventanas",
        filterWindowsPlaceholder: "Filtrar por título o aplicación",
        language: "Idioma",
        loadingMessage: "Abriendo el espacio de trabajo y cargando la lista actual de ventanas.",
        logFile: "Archivo de registro",
        logs: "Registros",
        minimized: "Minimizada",
        noWindowsAvailable:
          "Todavía no hay ventanas disponibles. Lleva la aplicación objetivo al escritorio y espera un momento.",
        noWindowsMatch: "Ninguna ventana coincide con el filtro actual.",
        off: "Apagado",
        openLogs: "Abrir registros",
        openLogsFailure: "No se pudo abrir el directorio de registros.",
        openProductFailure: `No se pudo abrir ${PRODUCT_NAME}.`,
        opening: "Abriendo…",
        pending: "Pendiente",
        process: "Proceso",
        refreshWindowListFailure: "No se pudo actualizar la lista de ventanas.",
        recentEvents: (count) => `Eventos recientes (${formatCount(count)})`,
        recentEventsSubtitle: "Los más nuevos primero.",
        relatedWindows: "Aplicar a ventanas relacionadas",
        relatedWindowsDescription:
          "Mantén automáticamente el efecto en nuevas ventanas de la misma aplicación cuando sea posible.",
        runtime: "Tiempo de ejecución",
        runtimeSubtitle: "Detalles locales del tiempo de ejecución.",
        selectWindowToContinue: "Selecciona una ventana para continuar.",
        selectedWindow: "Ventana seleccionada",
        selectedWindowEmpty:
          "Selecciona una ventana de la lista para elegir dónde debe ir el efecto.",
        settings: "Configuración",
        settingsFile: "Archivo de configuración",
        state: "Estado",
        supportDiagnostics: "Soporte y diagnósticos",
        system: "Sistema",
        theme: "Tema",
        title: "Título",
        turningOff: "Apagando…",
        turnOff: "Apagar",
        unexpectedBridgeError: "Error inesperado del puente del escritorio.",
        unavailable: "No disponible",
        windowCount: "Cantidad de ventanas",
        windowId: "ID de la ventana",
        windowClass: "Clase de ventana",
        windowsMatch: (count) => `${formatCount(count)} ventanas coinciden.`,
        windowsShown: (count) =>
          `${formatCount(count)} ventanas mostradas. Se actualiza automáticamente.`,
      };
    case "en":
      return {
        ...base,
        advancedDetails: "Advanced details",
        appSubtitle:
          "Choose a window and apply an effect without changing the rest of the desktop.",
        application: "Application",
        applied: "Applied",
        applying: "Applying…",
        availableWindows: "Available windows",
        backend: "Backend",
        bounds: "Bounds",
        chooseEffect: "Choose an effect",
        chooseWindow: "Choose a window",
        copyDebugReport: "Copy debug report",
        copyDebugReportFailure: "Failed to copy the debug report.",
        copied: "Copied",
        copying: "Copying…",
        effect: "Effect",
        effectHintDetached: "Choose how the selected window should look.",
        executablePath: "Executable path",
        executableUnavailable: "Executable unavailable",
        filterWindows: "Filter windows",
        filterWindowsPlaceholder: "Filter by title or app",
        language: "Language",
        loadingMessage: "Opening workspace and loading the current window list.",
        logFile: "Log file",
        logs: "Logs",
        minimized: "Minimized",
        noWindowsAvailable:
          "No windows are available yet. Bring the target app to the desktop and wait a moment.",
        noWindowsMatch: "No windows match the current filter.",
        off: "Off",
        openLogs: "Open logs",
        openLogsFailure: "Failed to open the logs directory.",
        openProductFailure: `Failed to open ${PRODUCT_NAME}.`,
        opening: "Opening…",
        pending: "Pending",
        process: "Process",
        refreshWindowListFailure: "Failed to refresh the window list.",
        recentEvents: (count) => `Recent events (${formatCount(count)})`,
        recentEventsSubtitle: "Newest events first.",
        relatedWindows: "Apply to related windows",
        relatedWindowsDescription:
          "Automatically keep the effect on new windows from the same app when possible.",
        runtime: "Runtime",
        runtimeSubtitle: "Local-only runtime details.",
        selectWindowToContinue: "Select a window to continue.",
        selectedWindow: "Selected window",
        selectedWindowEmpty: "Select a window from the list to choose where the effect should go.",
        settings: "Settings",
        settingsFile: "Settings file",
        state: "State",
        supportDiagnostics: "Support & diagnostics",
        system: "System",
        theme: "Theme",
        title: "Title",
        turningOff: "Turning off…",
        turnOff: "Turn off",
        unexpectedBridgeError: "Unexpected desktop bridge error.",
        unavailable: "Unavailable",
        windowCount: "Window count",
        windowId: "Window ID",
        windowClass: "Window class",
        windowsMatch: (count) => `${formatCount(count)} windows match.`,
        windowsShown: (count) => `${formatCount(count)} windows shown. Updates automatically.`,
      };
  }
}

function getPresetLabel(language: ResolvedLanguage, preset: VisualPreset) {
  switch (preset) {
    case "invert":
      return language === "pt-BR" ? "Inverter" : language === "es" ? "Invertir" : "Invert";
    case "warmDim":
      return language === "pt-BR"
        ? "Suavizar quente"
        : language === "es"
          ? "Atenuar cálido"
          : "Warm Dim";
    case "greyscaleInvert":
      return language === "pt-BR"
        ? "Inverter em tons de cinza"
        : language === "es"
          ? "Invertir en escala de grises"
          : "Greyscale Invert";
  }
}

function getPresetSummary(language: ResolvedLanguage, preset: VisualPreset) {
  switch (preset) {
    case "invert":
      return language === "pt-BR"
        ? "Uma inversão colorida completa para apps em que sinais de cor ainda importam."
        : language === "es"
          ? "Una inversión a color completa para apps donde las señales de color siguen importando."
          : "A full-color invert for apps where non-grey color cues still matter.";
    case "warmDim":
      return language === "pt-BR"
        ? "Um tom âmbar mais quente que suaviza interfaces legadas cheias de branco."
        : language === "es"
          ? "Un matiz ámbar más cálido que suaviza interfaces heredadas cargadas de blanco."
          : "A warmer amber tint that softens white-heavy legacy interfaces.";
    case "greyscaleInvert":
      return language === "pt-BR"
        ? "Uma transformação para telas brancas agressivas que ignoram modo escuro."
        : language === "es"
          ? "Una transformación para pantallas blancas agresivas que ignoran el modo oscuro."
          : "A transform aimed at harsh white screens that ignore dark mode.";
  }
}

function getThemeLabel(language: ResolvedLanguage, theme: ThemePreference) {
  switch (theme) {
    case "system":
      return language === "pt-BR" ? "Sistema" : language === "es" ? "Sistema" : "System";
    case "light":
      return language === "pt-BR" ? "Claro" : language === "es" ? "Claro" : "Light";
    case "dark":
      return language === "pt-BR" ? "Escuro" : language === "es" ? "Oscuro" : "Dark";
    case "invert":
      return language === "pt-BR" ? "Inverter" : language === "es" ? "Invertir" : "Invert";
    case "greyscaleInvert":
      return language === "pt-BR"
        ? "Inverter em tons de cinza"
        : language === "es"
          ? "Invertir en escala de grises"
          : "Greyscale Invert";
  }
}

function getWindowEffectLabel(language: ResolvedLanguage, status: LensStatus) {
  switch (status) {
    case "pending":
      return language === "pt-BR" ? "Pendente" : language === "es" ? "Pendiente" : "Pending";
    case "attached":
    case "suspended":
      return language === "pt-BR" ? "Aplicado" : language === "es" ? "Aplicado" : "Applied";
    case "detached":
      return language === "pt-BR" ? "Desligado" : language === "es" ? "Apagado" : "Off";
  }
}

function getWindowState(language: ResolvedLanguage, state: WindowAttachmentState) {
  switch (state) {
    case "available":
      return language === "pt-BR" ? "Pronta" : language === "es" ? "Lista" : "Ready";
    case "minimized":
      return language === "pt-BR"
        ? "Minimizada; o efeito aparece quando ela voltar à tela"
        : language === "es"
          ? "Minimizada; el efecto aparece cuando vuelva a la pantalla"
          : "Minimized; the effect appears once it is back on screen";
  }
}

function detachedEffectMessage(language: ResolvedLanguage) {
  return language === "pt-BR"
    ? "Escolha como a janela selecionada deve ficar."
    : language === "es"
      ? "Elige cómo debe verse la ventana seleccionada."
      : "Choose how the selected window should look.";
}

function appliedOne(language: ResolvedLanguage, presetLabel: string, targetTitle: string | null) {
  const title = targetTitle ?? fallbackTarget(language);
  return language === "pt-BR"
    ? `${presetLabel} está ativo em ${title}.`
    : language === "es"
      ? `${presetLabel} está activo en ${title}.`
      : `${presetLabel} is active on ${title}.`;
}

function appliedMany(
  language: ResolvedLanguage,
  presetLabel: string,
  visibleCount: number,
  formatCount: (count: number) => string
) {
  return language === "pt-BR"
    ? `${presetLabel} está ativo em ${formatCount(visibleCount)} janelas do mesmo aplicativo.`
    : language === "es"
      ? `${presetLabel} está activo en ${formatCount(visibleCount)} ventanas de la misma aplicación.`
      : `${presetLabel} is active on ${formatCount(visibleCount)} windows from the same app.`;
}

function pendingOne(language: ResolvedLanguage, presetLabel: string, targetTitle: string | null) {
  const title = targetTitle ?? fallbackTarget(language);
  return language === "pt-BR"
    ? `${presetLabel} aparecerá quando ${title} voltar à tela.`
    : language === "es"
      ? `${presetLabel} aparecerá cuando ${title} vuelva a la pantalla.`
      : `${presetLabel} will appear when ${title} is back on screen.`;
}

function pendingMany(language: ResolvedLanguage, presetLabel: string) {
  return language === "pt-BR"
    ? `${presetLabel} aparecerá quando o aplicativo selecionado voltar à tela.`
    : language === "es"
      ? `${presetLabel} aparecerá cuando la aplicación seleccionada vuelva a la pantalla.`
      : `${presetLabel} will appear when the selected app is back on screen.`;
}

function fallbackTarget(language: ResolvedLanguage) {
  return language === "pt-BR"
    ? "a janela selecionada"
    : language === "es"
      ? "la ventana seleccionada"
      : "the selected window";
}

function getApplying(language: ResolvedLanguage) {
  return language === "pt-BR" ? "Aplicando…" : language === "es" ? "Aplicando…" : "Applying…";
}

function getChooseWindow(language: ResolvedLanguage) {
  return language === "pt-BR"
    ? "Escolha uma janela"
    : language === "es"
      ? "Elige una ventana"
      : "Choose a window";
}

function getChooseEffect(language: ResolvedLanguage) {
  return language === "pt-BR"
    ? "Escolha um efeito"
    : language === "es"
      ? "Elige un efecto"
      : "Choose an effect";
}

function getApplyPreset(language: ResolvedLanguage, presetLabel: string) {
  return language === "pt-BR"
    ? `Aplicar ${presetLabel}`
    : language === "es"
      ? `Aplicar ${presetLabel}`
      : `Apply ${presetLabel}`;
}

function getSelectWindowToContinue(language: ResolvedLanguage) {
  return language === "pt-BR"
    ? "Selecione uma janela para continuar."
    : language === "es"
      ? "Selecciona una ventana para continuar."
      : "Select a window to continue.";
}

function getApplyHintMinimized(language: ResolvedLanguage) {
  return language === "pt-BR"
    ? "Esta janela está minimizada. O efeito aparecerá quando ela voltar à tela."
    : language === "es"
      ? "Esta ventana está minimizada. El efecto aparecerá cuando vuelva a la pantalla."
      : "This window is minimized. The effect will appear when it is back on screen.";
}

function getApplyHintReady(language: ResolvedLanguage) {
  return language === "pt-BR"
    ? "Pronto para aplicar o efeito selecionado a esta janela."
    : language === "es"
      ? "Listo para aplicar el efecto seleccionado a esta ventana."
      : "Ready to apply the selected effect to this window.";
}
