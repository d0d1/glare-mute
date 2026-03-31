import { startTransition, useEffect, useState } from "react";

import { EffectPane } from "../features/effects/EffectPane";
import {
  localizePresetDefinitions,
  themeOptionsFor,
  visibleEffectPresets,
} from "../features/effects/effect-utils";
import { SettingsPanel } from "../features/settings/SettingsPanel";
import { SupportPanel } from "../features/support/SupportPanel";
import { WindowPane } from "../features/windows/WindowPane";
import { filterWindowCandidates } from "../features/windows/window-utils";
import type { AppLanguage, AppSnapshot, ThemePreference, VisualPreset } from "../lib/contracts";
import { desktopClient } from "../lib/desktop-client";
import { PRODUCT_NAME, getMessages, languageOptions, resolveEffectiveLanguage } from "../lib/i18n";
import {
  applyDocumentTheme,
  getSystemPrefersDark,
  resolveEffectiveTheme,
  watchSystemTheme,
} from "../lib/theme";

type BusyAction = "apply" | "copy" | "logs" | "settings" | "turnOff" | null;

const DEFAULT_PRESET: VisualPreset = "invert";

function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [prefersDark, setPrefersDark] = useState(() => getSystemPrefersDark());
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<VisualPreset>(DEFAULT_PRESET);
  const [windowQuery, setWindowQuery] = useState("");

  const languagePreference: AppLanguage = snapshot?.settings.language ?? "system";
  const language = resolveEffectiveLanguage(languagePreference);
  const messages = getMessages(language);

  useEffect(() => watchSystemTheme(setPrefersDark), []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const nextSnapshot = await desktopClient.bootstrapState();
        if (!active) {
          return;
        }

        startTransition(() => {
          setSnapshot(nextSnapshot);
          setErrorMessage(null);
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : messages.openProductFailure);
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [messages.openProductFailure]);

  const effectiveTheme = resolveEffectiveTheme(
    snapshot?.settings.themePreference ?? "system",
    prefersDark
  );

  useEffect(() => {
    applyDocumentTheme(effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const backendId = snapshot?.platform.backendId ?? null;

  useEffect(() => {
    if (!backendId) {
      return;
    }

    void desktopClient.appendFrontendLog(
      "debug",
      "ui",
      `desktop surface hydrated with ${backendId}`
    );
  }, [backendId]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const nextEffectChoices = visibleEffectPresets(snapshot.presets);
    setSelectedPreset((current) =>
      nextEffectChoices.some((preset) => preset.id === current)
        ? current
        : snapshot.lens.activePreset &&
            nextEffectChoices.some((preset) => preset.id === snapshot.lens.activePreset)
          ? snapshot.lens.activePreset
          : (nextEffectChoices[0]?.id ?? DEFAULT_PRESET)
    );
  }, [snapshot]);

  const allWindowCandidates = snapshot?.windowCandidates ?? [];
  const effectChoices = visibleEffectPresets(snapshot?.presets ?? []);
  const localizedEffectChoices = localizePresetDefinitions(effectChoices, messages);
  const filteredWindowCandidates = filterWindowCandidates(allWindowCandidates, windowQuery);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const nextCandidates = filterWindowCandidates(snapshot.windowCandidates, windowQuery);

    setSelectedWindowId((current) => {
      const currentWindow =
        nextCandidates.find((candidate) => candidate.windowId === current) ?? null;
      if (currentWindow) {
        return currentWindow.windowId;
      }

      const activeWindowId = snapshot.lens.activeTarget?.windowId;
      if (
        activeWindowId &&
        nextCandidates.some((candidate) => candidate.windowId === activeWindowId)
      ) {
        return activeWindowId;
      }

      return null;
    });
  }, [snapshot, windowQuery]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const interval = window.setInterval(() => {
      void desktopClient
        .refreshWindowCandidates()
        .then((nextSnapshot: AppSnapshot) => {
          startTransition(() => setSnapshot(nextSnapshot));
        })
        .catch((error: unknown) => {
          setErrorMessage(
            error instanceof Error ? error.message : messages.refreshWindowListFailure
          );
        });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [snapshot, messages.refreshWindowListFailure]);

  const selectedWindow =
    allWindowCandidates.find((candidate) => candidate.windowId === selectedWindowId) ?? null;
  const coveredWindowIds = new Set(
    snapshot?.lens.coveredTargets.map((target) => target.windowId) ?? []
  );
  const selectedPresetDefinition =
    localizedEffectChoices.find((preset) => preset.id === selectedPreset) ?? null;
  const languageChoices = languageOptions(messages);
  const themeChoices = themeOptionsFor(messages);
  const canAttachSelectedWindow = Boolean(selectedWindow) && busyAction !== "apply";

  async function updateSnapshot(task: () => Promise<AppSnapshot>, busy: BusyAction) {
    setBusyAction(busy);
    setErrorMessage(null);

    try {
      const nextSnapshot = await task();
      startTransition(() => setSnapshot(nextSnapshot));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : messages.unexpectedBridgeError);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLanguageChange(nextLanguage: AppLanguage) {
    if (!snapshot || snapshot.settings.language === nextLanguage) {
      return;
    }

    await updateSnapshot(() => desktopClient.setLanguage(nextLanguage), "settings");
  }

  async function handleThemeChange(nextTheme: ThemePreference) {
    if (!snapshot || snapshot.settings.themePreference === nextTheme) {
      return;
    }

    await updateSnapshot(() => desktopClient.setThemePreference(nextTheme), "settings");
  }

  async function handleRelatedWindowScopeChange(enabled: boolean) {
    if (!snapshot || snapshot.settings.applyToRelatedWindows === enabled) {
      return;
    }

    await updateSnapshot(() => desktopClient.setApplyToRelatedWindows(enabled), "settings");
  }

  async function handleAttachSelectedWindow() {
    if (!selectedWindow || !canAttachSelectedWindow) {
      return;
    }

    await updateSnapshot(
      () => desktopClient.attachWindow(selectedWindow.windowId, selectedPreset),
      "apply"
    );
  }

  async function handleDetachLens() {
    await updateSnapshot(() => desktopClient.detachLens(), "turnOff");
  }

  async function handleOpenLogs() {
    setBusyAction("logs");
    setErrorMessage(null);

    try {
      await desktopClient.openLogsDirectory();
      await desktopClient.appendFrontendLog("info", "ui", "log directory opened");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : messages.openLogsFailure);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCopyDebugReport() {
    setBusyAction("copy");
    setErrorMessage(null);

    try {
      const report = await desktopClient.getDebugReport();
      await navigator.clipboard.writeText(report);
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 2400);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : messages.copyDebugReportFailure);
    } finally {
      setBusyAction(null);
    }
  }

  if (!snapshot) {
    return (
      <div className="app-shell">
        <div className="app-frame loading-frame">
          <section className="loading-card">
            <h1>{PRODUCT_NAME}</h1>
            <p className="body-copy">{messages.loadingMessage}</p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="product-header">
          <h1>{PRODUCT_NAME}</h1>
          <p className="app-subtitle">{messages.appSubtitle}</p>
        </header>

        {errorMessage ? (
          <output aria-live="polite" className="alert">
            {errorMessage}
          </output>
        ) : null}

        <main className="workflow-shell">
          <WindowPane
            allWindowCandidates={allWindowCandidates}
            coveredWindowIds={coveredWindowIds}
            filteredWindowCandidates={filteredWindowCandidates}
            messages={messages}
            onSelectWindow={setSelectedWindowId}
            onWindowQueryChange={setWindowQuery}
            selectedWindowId={selectedWindowId}
            windowQuery={windowQuery}
          />

          <EffectPane
            busyAction={busyAction}
            canAttachSelectedWindow={canAttachSelectedWindow}
            messages={messages}
            onAttach={() => void handleAttachSelectedWindow()}
            onDetach={() => void handleDetachLens()}
            onPresetChange={setSelectedPreset}
            selectedPreset={selectedPreset}
            selectedPresetDefinition={selectedPresetDefinition}
            selectedWindow={selectedWindow}
            snapshot={{
              ...snapshot,
              presets: localizedEffectChoices,
            }}
          />
        </main>

        <SettingsPanel
          busyAction={busyAction}
          languageChoices={languageChoices}
          messages={messages}
          onLanguageChange={(language) => void handleLanguageChange(language)}
          onRelatedWindowScopeChange={(enabled) => void handleRelatedWindowScopeChange(enabled)}
          onThemeChange={(theme) => void handleThemeChange(theme)}
          settings={snapshot.settings}
          themeChoices={themeChoices}
        />

        {snapshot.devMode ? (
          <SupportPanel
            busyAction={busyAction}
            copiedReport={copiedReport}
            messages={messages}
            onCopyDebugReport={() => void handleCopyDebugReport()}
            onOpenLogs={() => void handleOpenLogs()}
            snapshot={snapshot}
          />
        ) : null}
      </div>
    </div>
  );
}

export default App;
