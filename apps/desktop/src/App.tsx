import {
  type KeyboardEvent as ReactKeyboardEvent,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css";
import type {
  AppLanguage,
  AppSnapshot,
  PresetDefinition,
  RuntimeEvent,
  ThemePreference,
  VisualPreset,
  WindowDescriptor,
} from "./lib/contracts";
import { desktopClient } from "./lib/desktop-client";
import {
  type Messages,
  PRODUCT_NAME,
  getMessages,
  languageOptions,
  resolveEffectiveLanguage,
} from "./lib/i18n";
import {
  applyDocumentTheme,
  getSystemPrefersDark,
  resolveEffectiveTheme,
  watchSystemTheme,
} from "./lib/theme";

type BusyAction = "apply" | "copy" | "logs" | "settings" | "turnOff" | null;
type StatusTone = "available" | "experimental" | "planned" | "unsupported" | "neutral";
type ChoiceOption = { label: string; value: string };

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
  const hasSnapshot = snapshot !== null;
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
    if (!hasSnapshot) {
      return;
    }

    const interval = window.setInterval(() => {
      void desktopClient
        .refreshWindowCandidates()
        .then((nextSnapshot) => {
          startTransition(() => setSnapshot(nextSnapshot));
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error ? error.message : messages.refreshWindowListFailure
          );
        });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [hasSnapshot, messages.refreshWindowListFailure]);

  const selectedWindow =
    allWindowCandidates.find((candidate) => candidate.windowId === selectedWindowId) ?? null;
  const activeTarget = snapshot?.lens.activeTarget ?? null;
  const coveredWindowIds = new Set(
    snapshot?.lens.coveredTargets.map((target) => target.windowId) ?? []
  );
  const selectedPresetDefinition =
    localizedEffectChoices.find((preset) => preset.id === selectedPreset) ?? null;
  const languageChoices = languageOptions(messages);
  const themeOptions = themeOptionsFor(messages);
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
          <section className="workflow-pane window-pane">
            <PaneHeader
              subtitle={windowListSubtitle(messages, filteredWindowCandidates.length, windowQuery)}
              title={messages.availableWindows}
            />

            <input
              aria-label={messages.filterWindows}
              className="search-input"
              onChange={(event) => setWindowQuery(event.target.value)}
              placeholder={messages.filterWindowsPlaceholder}
              type="search"
              value={windowQuery}
            />

            {filteredWindowCandidates.length > 0 ? (
              <ul aria-label={messages.availableWindows} className="window-list">
                {filteredWindowCandidates.map((candidate) => (
                  <WindowRow
                    candidate={candidate}
                    key={candidate.windowId}
                    lensStatus={windowLensStatus(candidate, coveredWindowIds)}
                    messages={messages}
                    onSelect={() => setSelectedWindowId(candidate.windowId)}
                    selected={selectedWindowId === candidate.windowId}
                  />
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                {allWindowCandidates.length === 0
                  ? messages.noWindowsAvailable
                  : messages.noWindowsMatch}
              </div>
            )}
          </section>

          <section className="workflow-pane effect-pane">
            <div className="effect-header">
              <PaneHeader subtitle={effectMessage(messages, snapshot)} title={messages.effect} />
              <StatusChip
                label={effectStatusLabel(messages, snapshot.lens.status)}
                status={effectStatusChip(snapshot.lens.status)}
              />
            </div>

            <section className="pane-section effect-picker-section">
              <select
                aria-label={messages.effect}
                className="field-select"
                id="effect-select"
                onChange={(event) => setSelectedPreset(event.target.value as VisualPreset)}
                value={selectedPreset}
              >
                {localizedEffectChoices.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              {selectedPresetDefinition ? (
                <div className="field-note">
                  <p className="body-copy">{selectedPresetDefinition.summary}</p>
                </div>
              ) : null}
            </section>

            <section className="pane-section action-section">
              <button
                className="button"
                disabled={!canAttachSelectedWindow}
                onClick={() => void handleAttachSelectedWindow()}
                type="button"
              >
                {messages.applyButton({
                  busy: busyAction === "apply",
                  hasPreset: Boolean(selectedPresetDefinition),
                  hasSelectedWindow: Boolean(selectedWindow),
                  presetLabel: selectedPresetDefinition?.label ?? null,
                })}
              </button>
              <p className="body-copy action-hint">
                {messages.applyHint(selectedWindow?.attachmentState ?? null)}
              </p>
              <div className="button-row">
                <button
                  className="button button-secondary"
                  disabled={!activeTarget || busyAction === "turnOff"}
                  onClick={() => void handleDetachLens()}
                  type="button"
                >
                  {busyAction === "turnOff" ? messages.turningOff : messages.turnOff}
                </button>
              </div>
            </section>

            <section className="pane-section selected-window-section">
              <PaneHeader title={messages.selectedWindow} />
              {selectedWindow ? (
                <SelectedWindowDetails
                  candidate={selectedWindow}
                  devMode={snapshot.devMode}
                  messages={messages}
                />
              ) : (
                <div className="empty-state">{messages.selectedWindowEmpty}</div>
              )}
            </section>
          </section>
        </main>

        <details className="drawer-panel settings-panel">
          <summary>
            <span>{messages.settings}</span>
          </summary>
          <div className="drawer-body">
            <section className="drawer-section">
              <ChoiceField
                disabled={busyAction === "settings"}
                id="language-select"
                label={messages.language}
                onChange={(value) => void handleLanguageChange(value as AppLanguage)}
                options={languageChoices}
                value={snapshot.settings.language}
              />
            </section>
            <section className="drawer-section">
              <ChoiceField
                disabled={busyAction === "settings"}
                id="theme-select"
                label={messages.theme}
                onChange={(value) => void handleThemeChange(value as ThemePreference)}
                options={themeOptions}
                value={snapshot.settings.themePreference}
              />
            </section>
            <section className="drawer-section">
              <label className="toggle-switch" htmlFor="related-windows-toggle">
                <span className="toggle-switch-wrap">
                  <input
                    aria-checked={snapshot.settings.applyToRelatedWindows}
                    checked={snapshot.settings.applyToRelatedWindows}
                    className="toggle-switch-input"
                    disabled={busyAction === "settings"}
                    id="related-windows-toggle"
                    onChange={(event) => void handleRelatedWindowScopeChange(event.target.checked)}
                    role="switch"
                    type="checkbox"
                  />
                  <span aria-hidden="true" className="toggle-switch-control" />
                </span>
                <div className="toggle-copy">
                  <span className="field-label">{messages.relatedWindows}</span>
                  <p className="body-copy">{messages.relatedWindowsDescription}</p>
                </div>
              </label>
            </section>
          </div>
        </details>

        {snapshot.devMode ? (
          <details className="drawer-panel support-panel">
            <summary>
              <span>{messages.supportDiagnostics}</span>
            </summary>
            <div className="drawer-body">
              <div className="support-actions">
                <button
                  className="button button-secondary"
                  disabled={busyAction === "logs"}
                  onClick={() => void handleOpenLogs()}
                  type="button"
                >
                  {busyAction === "logs" ? messages.opening : messages.openLogs}
                </button>
                <button
                  className="button button-secondary"
                  disabled={busyAction === "copy"}
                  onClick={() => void handleCopyDebugReport()}
                  type="button"
                >
                  {busyAction === "copy"
                    ? messages.copying
                    : copiedReport
                      ? messages.copied
                      : messages.copyDebugReport}
                </button>
              </div>

              <div className="support-grid">
                <section className="drawer-section">
                  <PaneHeader subtitle={messages.runtimeSubtitle} title={messages.runtime} />
                  <dl className="detail-list">
                    <div>
                      <dt>{messages.backend}</dt>
                      <dd>{snapshot.platform.backendLabel}</dd>
                    </div>
                    <div>
                      <dt>{messages.windowCount}</dt>
                      <dd>{snapshot.windowCandidates.length.toString()}</dd>
                    </div>
                    <div>
                      <dt>{messages.settingsFile}</dt>
                      <dd>{snapshot.diagnostics.settingsFile}</dd>
                    </div>
                    <div>
                      <dt>{messages.logFile}</dt>
                      <dd>{snapshot.diagnostics.logFile}</dd>
                    </div>
                  </dl>
                </section>

                <section className="drawer-section">
                  <PaneHeader
                    subtitle={messages.recentEventsSubtitle}
                    title={messages.recentEvents(snapshot.diagnostics.recentEvents.length)}
                  />
                  <div className="log-list">
                    {snapshot.diagnostics.recentEvents.slice(0, 8).map((event) => (
                      <LogItem event={event} key={`${event.timestamp}-${event.message}`} />
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function ChoiceField({
  disabled,
  id,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedOption = options.find((option) => option.value === value) ?? options[0] ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const root = rootRef.current;

    const handlePointerDown = (event: MouseEvent) => {
      if (!root?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!root?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updateDirection = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;

      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const estimatedHeight =
        menu?.offsetHeight ?? Math.min(Math.max(options.length, 1), 6) * 44 + 16;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      setOpenUpward(spaceBelow < estimatedHeight && spaceAbove > spaceBelow);
    };

    updateDirection();

    const raf = window.requestAnimationFrame(() => {
      updateDirection();
      optionRefs.current.get(value)?.focus();
    });

    window.addEventListener("resize", updateDirection);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateDirection);
    };
  }, [open, options.length, value]);

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  function setOptionRef(optionValue: string, node: HTMLButtonElement | null) {
    if (node) {
      optionRefs.current.set(optionValue, node);
      return;
    }

    optionRefs.current.delete(optionValue);
  }

  function focusOption(index: number) {
    const nextOption = options[index];
    if (!nextOption) {
      return;
    }

    optionRefs.current.get(nextOption.value)?.focus();
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, optionValue: string) {
    const currentIndex = options.findIndex((option) => option.value === optionValue);

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusOption(Math.min(currentIndex + 1, options.length - 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        focusOption(Math.max(currentIndex - 1, 0));
        return;
      case "Home":
        event.preventDefault();
        focusOption(0);
        return;
      case "End":
        event.preventDefault();
        focusOption(options.length - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        setOpen(false);
        if (optionValue !== value) {
          onChange(optionValue);
        }
        return;
      case "Tab":
        setOpen(false);
        return;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
    }
  }

  return (
    <div
      className="choice-field"
      data-open={open ? "true" : "false"}
      data-open-upward={openUpward ? "true" : "false"}
      ref={rootRef}
    >
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <button
        aria-expanded={open}
        className="choice-trigger"
        data-open={open ? "true" : "false"}
        disabled={disabled || !selectedOption}
        id={id}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
      >
        <span>{selectedOption?.label ?? ""}</span>
        <span aria-hidden="true" className="choice-caret" />
      </button>

      {open ? (
        <div className="choice-menu" ref={menuRef}>
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                aria-pressed={selected}
                className="choice-option"
                data-selected={selected}
                key={option.value}
                onClick={() => {
                  setOpen(false);
                  if (option.value !== value) {
                    onChange(option.value);
                  }
                }}
                onKeyDown={(event) => handleOptionKeyDown(event, option.value)}
                ref={(node) => setOptionRef(option.value, node)}
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                <span>{option.label}</span>
                <span
                  aria-hidden="true"
                  className="choice-option-indicator"
                  data-selected={selected}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function PaneHeader({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <div className="pane-copy">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

function WindowRow({
  candidate,
  lensStatus,
  messages,
  onSelect,
  selected,
}: {
  candidate: WindowDescriptor;
  lensStatus: AppSnapshot["lens"]["status"] | null;
  messages: Messages;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <li className="window-row" data-attachable={candidate.attachmentState === "available"}>
      <button
        aria-selected={selected}
        className="window-select"
        data-selected={selected}
        onClick={onSelect}
        type="button"
      >
        <div className="window-title-line">
          <strong className="window-title">{candidate.title}</strong>
          <div className="window-state">
            {candidate.attachmentState === "minimized" ? (
              <StatusChip label={messages.minimized} status="neutral" />
            ) : null}
            {lensStatus ? (
              <StatusChip
                label={messages.windowEffectLabel(lensStatus)}
                status={windowEffectTone(lensStatus)}
              />
            ) : null}
          </div>
        </div>
        <p className="window-subtitle">{executableName(messages, candidate.executablePath)}</p>
      </button>
    </li>
  );
}

function SelectedWindowDetails({
  candidate,
  devMode,
  messages,
}: {
  candidate: WindowDescriptor;
  devMode: boolean;
  messages: Messages;
}) {
  return (
    <>
      <dl className="detail-list">
        <div>
          <dt>{messages.title}</dt>
          <dd>{candidate.title}</dd>
        </div>
        <div>
          <dt>{messages.state}</dt>
          <dd>{messages.windowState(candidate.attachmentState)}</dd>
        </div>
        <div>
          <dt>{messages.application}</dt>
          <dd>{executableName(messages, candidate.executablePath)}</dd>
        </div>
      </dl>
      {devMode ? (
        <details className="inline-details">
          <summary>{messages.advancedDetails}</summary>
          <dl className="detail-list advanced-detail-list">
            <div>
              <dt>{messages.executablePath}</dt>
              <dd>{candidate.executablePath ?? messages.unavailable}</dd>
            </div>
            <div>
              <dt>{messages.windowClass}</dt>
              <dd>{candidate.windowClass ?? messages.unavailable}</dd>
            </div>
            <div>
              <dt>{messages.bounds}</dt>
              <dd>{formatBounds(candidate)}</dd>
            </div>
            <div>
              <dt>{messages.process}</dt>
              <dd>{candidate.processId.toString()}</dd>
            </div>
            <div>
              <dt>{messages.windowId}</dt>
              <dd>{candidate.windowId}</dd>
            </div>
          </dl>
        </details>
      ) : null}
    </>
  );
}

function LogItem({ event }: { event: RuntimeEvent }) {
  return (
    <article className="log-item">
      <div className="log-meta">
        <StatusChip label={event.level} status={levelToStatus(event.level)} />
        <span>{event.source}</span>
        <span>{event.timestamp}</span>
      </div>
      <p className="body-copy">{event.message}</p>
    </article>
  );
}

function StatusChip({
  label,
  status,
}: {
  label?: string;
  status: StatusTone;
}) {
  return (
    <span className="status-chip" data-status={status}>
      {label ?? status}
    </span>
  );
}

function filterWindowCandidates(candidates: WindowDescriptor[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return candidates;
  }

  return candidates.filter((candidate) => {
    const haystack = [
      candidate.title,
      candidate.executablePath ?? "",
      executableName(getMessages("en"), candidate.executablePath),
      candidate.windowClass ?? "",
      candidate.attachmentState,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function windowListSubtitle(messages: Messages, totalCount: number, query: string) {
  if (query.trim()) {
    return messages.windowsMatch(totalCount);
  }

  return messages.windowsShown(totalCount);
}

function executableName(messages: Messages, path: string | null) {
  if (!path) {
    return messages.executableUnavailable;
  }

  return path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;
}

function formatBounds(candidate: WindowDescriptor) {
  return `${candidate.bounds.width}x${candidate.bounds.height} at ${candidate.bounds.left}, ${candidate.bounds.top}`;
}

function effectStatusLabel(messages: Messages, status: AppSnapshot["lens"]["status"]) {
  return messages.windowEffectLabel(status);
}

function effectMessage(messages: Messages, snapshot: AppSnapshot) {
  if (snapshot.lens.status === "detached" || !snapshot.lens.activePreset) {
    return messages.effectHintDetached;
  }

  return messages.effectSummary({
    coveredCount: snapshot.lens.coveredTargets.length,
    presetLabel: messages.presetLabel(snapshot.lens.activePreset),
    status: snapshot.lens.status,
    targetTitle: snapshot.lens.activeTarget?.title ?? null,
    visibleCount: snapshot.lens.coveredTargets.filter(
      (target) => target.attachmentState === "available"
    ).length,
  });
}

function effectStatusChip(status: AppSnapshot["lens"]["status"]): StatusTone {
  switch (status) {
    case "pending":
      return "neutral";
    case "attached":
      return "available";
    case "detached":
      return "neutral";
    case "suspended":
      return "neutral";
  }
}

function levelToStatus(level: RuntimeEvent["level"]): StatusTone {
  switch (level) {
    case "error":
      return "unsupported";
    case "warn":
      return "experimental";
    case "trace":
    case "debug":
      return "planned";
    case "info":
      return "available";
  }
}

function themeOptionsFor(messages: Messages) {
  return [
    { label: messages.themeLabel("system"), value: "system" as ThemePreference },
    { label: messages.themeLabel("light"), value: "light" as ThemePreference },
    { label: messages.themeLabel("dark"), value: "dark" as ThemePreference },
    { label: messages.themeLabel("invert"), value: "invert" as ThemePreference },
    {
      label: messages.themeLabel("greyscaleInvert"),
      value: "greyscaleInvert" as ThemePreference,
    },
  ];
}

function localizePresetDefinitions(presets: PresetDefinition[], messages: Messages) {
  return presets.map((preset) => ({
    ...preset,
    label: messages.presetLabel(preset.id),
    summary: messages.presetSummary(preset.id),
  }));
}

function visibleEffectPresets(presets: PresetDefinition[]) {
  return presets.filter((preset) => preset.id !== "warmDim");
}

function windowLensStatus(
  candidate: WindowDescriptor,
  coveredWindowIds: Set<string>
): AppSnapshot["lens"]["status"] | null {
  if (!coveredWindowIds.has(candidate.windowId)) {
    return null;
  }

  return candidate.attachmentState === "minimized" ? "pending" : "attached";
}

function windowEffectTone(status: AppSnapshot["lens"]["status"]): StatusTone {
  switch (status) {
    case "attached":
      return "available";
    case "pending":
      return "neutral";
    case "suspended":
      return "available";
    case "detached":
      return "neutral";
  }
}

export default App;
