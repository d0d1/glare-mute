import { startTransition, useEffect, useState } from "react";

import "./App.css";
import type {
  AppSnapshot,
  CapabilityDescriptor,
  CapabilityStatus,
  PresetDefinition,
  RuntimeEvent,
  ThemePreference,
  VisualPreset,
  WindowDescriptor,
} from "./lib/contracts";
import { desktopClient } from "./lib/desktop-client";
import {
  applyDocumentTheme,
  getSystemPrefersDark,
  resolveEffectiveTheme,
  watchSystemTheme,
} from "./lib/theme";

type BusyAction = "apply" | "copy" | "logs" | "pause" | "theme" | "turnOff" | null;
type StatusTone = CapabilityStatus | "neutral";

const DEFAULT_PRESET: VisualPreset = "greyscaleInvert";
const THEME_OPTIONS: Array<{ hint: string; label: string; value: ThemePreference }> = [
  { hint: "Follow the operating system theme.", label: "System", value: "system" },
  { hint: "Force GlareMute into the lighter appearance.", label: "Light", value: "light" },
  { hint: "Force GlareMute into the darker appearance.", label: "Dark", value: "dark" },
  {
    hint: "Use the native in-app greyscale invert appearance.",
    label: "Greyscale Invert",
    value: "greyscaleInvert",
  },
];

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

        setErrorMessage(error instanceof Error ? error.message : "Failed to open GlareMute.");
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const effectiveTheme = resolveEffectiveTheme(
    snapshot?.settings.themePreference ?? "system",
    prefersDark
  );

  useEffect(() => {
    applyDocumentTheme(effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    void desktopClient.appendFrontendLog(
      "debug",
      "ui",
      `desktop surface hydrated with ${snapshot.platform.backendId}`
    );
  }, [snapshot]);

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
            error instanceof Error ? error.message : "Failed to refresh the window list."
          );
        });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [hasSnapshot]);

  const selectedWindow =
    allWindowCandidates.find((candidate) => candidate.windowId === selectedWindowId) ?? null;
  const activeTarget = snapshot?.lens.activeTarget ?? null;
  const selectedPresetDefinition =
    effectChoices.find((preset) => preset.id === selectedPreset) ?? null;
  const selectedPresetCapability = snapshot
    ? presetCapability(snapshot.platform.capabilities, selectedPreset)
    : null;
  const selectedPresetStatus = selectedPresetCapability?.status ?? "unsupported";
  const canAttachSelectedWindow =
    Boolean(selectedWindow) && selectedPresetStatus === "available" && busyAction !== "apply";

  async function updateSnapshot(task: () => Promise<AppSnapshot>, busy: BusyAction) {
    setBusyAction(busy);
    setErrorMessage(null);

    try {
      const nextSnapshot = await task();
      startTransition(() => setSnapshot(nextSnapshot));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unexpected desktop bridge error.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleThemeChange(nextTheme: ThemePreference) {
    if (!snapshot || snapshot.settings.themePreference === nextTheme) {
      return;
    }

    await updateSnapshot(() => desktopClient.setThemePreference(nextTheme), "theme");
  }

  async function handleSuspendToggle() {
    await updateSnapshot(() => desktopClient.toggleSuspend(), "pause");
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
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to open the logs directory."
      );
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
      setErrorMessage(error instanceof Error ? error.message : "Failed to copy the debug report.");
    } finally {
      setBusyAction(null);
    }
  }

  if (!snapshot) {
    return (
      <div className="app-shell">
        <div className="app-frame loading-frame">
          <section className="loading-card">
            <h1>GlareMute</h1>
            <p className="body-copy">Opening workspace and loading the current window list.</p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="product-header">
          <h1>GlareMute</h1>
          <p className="app-subtitle">
            Choose a window and apply an effect without changing the rest of the desktop.
          </p>
        </header>

        {errorMessage ? (
          <output aria-live="polite" className="alert">
            {errorMessage}
          </output>
        ) : null}

        <main className="workflow-shell">
          <section className="workflow-pane window-pane">
            <PaneHeader
              subtitle={windowListSubtitle(filteredWindowCandidates.length, windowQuery)}
              title="Available windows"
            />

            <input
              aria-label="Filter windows"
              className="search-input"
              onChange={(event) => setWindowQuery(event.target.value)}
              placeholder="Filter by title or app"
              type="search"
              value={windowQuery}
            />

            {filteredWindowCandidates.length > 0 ? (
              <ul aria-label="Available windows" className="window-list">
                {filteredWindowCandidates.map((candidate) => (
                  <WindowRow
                    candidate={candidate}
                    key={candidate.windowId}
                    lensStatus={
                      activeTarget?.windowId === candidate.windowId ? snapshot.lens.status : null
                    }
                    onSelect={() => setSelectedWindowId(candidate.windowId)}
                    selected={selectedWindowId === candidate.windowId}
                  />
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                {allWindowCandidates.length === 0
                  ? "No windows are available yet. Bring the target app to the desktop and wait a moment."
                  : "No windows match the current filter."}
              </div>
            )}
          </section>

          <section className="workflow-pane effect-pane">
            <div className="effect-header">
              <PaneHeader subtitle={effectMessage(snapshot)} title="Effect" />
              <StatusChip
                label={effectStatusLabel(snapshot.lens.status)}
                status={effectStatusChip(snapshot.lens.status)}
              />
            </div>

            <section className="pane-section effect-picker-section">
              <select
                aria-label="Effect"
                className="field-select"
                id="effect-select"
                onChange={(event) => setSelectedPreset(event.target.value as VisualPreset)}
                value={selectedPreset}
              >
                {effectChoices.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              {selectedPresetDefinition ? (
                <div className="field-note">
                  <StatusChip
                    label={presetAvailabilityLabel(selectedPresetStatus)}
                    status={statusTone(selectedPresetStatus)}
                  />
                  <p className="body-copy">{selectedPresetDefinition.summary}</p>
                  {selectedPresetStatus !== "available" ? (
                    <p className="body-copy muted-copy">{selectedPresetCapability?.summary}</p>
                  ) : null}
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
                {applyButtonLabel(
                  busyAction,
                  selectedPresetDefinition,
                  selectedPresetStatus,
                  selectedWindow
                )}
              </button>
              <p className="body-copy action-hint">
                {applyHint(selectedWindow, selectedPresetCapability, selectedPresetStatus)}
              </p>
              <div className="button-row">
                <button
                  className="button button-secondary"
                  disabled={!activeTarget || busyAction === "pause"}
                  onClick={() => void handleSuspendToggle()}
                  type="button"
                >
                  {busyAction === "pause"
                    ? "Working…"
                    : snapshot.diagnostics.suspended
                      ? "Resume"
                      : "Pause"}
                </button>
                <button
                  className="button button-secondary"
                  disabled={!activeTarget || busyAction === "turnOff"}
                  onClick={() => void handleDetachLens()}
                  type="button"
                >
                  {busyAction === "turnOff" ? "Turning off…" : "Turn off"}
                </button>
              </div>
              <dl className="detail-list session-details">
                <div>
                  <dt>Window</dt>
                  <dd>{activeTarget?.title ?? selectedWindow?.title ?? "No window selected"}</dd>
                </div>
                <div>
                  <dt>Shortcut</dt>
                  <dd>{snapshot.settings.panicHotkey}</dd>
                </div>
              </dl>
            </section>

            <section className="pane-section selected-window-section">
              <PaneHeader title="Selected window" />
              {selectedWindow ? (
                <SelectedWindowDetails candidate={selectedWindow} devMode={snapshot.devMode} />
              ) : (
                <div className="empty-state">
                  Select a window from the list to choose where the effect should go.
                </div>
              )}
            </section>
          </section>
        </main>

        <details className="drawer-panel settings-panel">
          <summary>
            <span>Settings</span>
          </summary>
          <div className="drawer-body">
            <section className="drawer-section">
              <label className="field-label" htmlFor="theme-select">
                Theme
              </label>
              <select
                className="field-select"
                disabled={busyAction === "theme"}
                id="theme-select"
                onChange={(event) => void handleThemeChange(event.target.value as ThemePreference)}
                value={snapshot.settings.themePreference}
              >
                {THEME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="body-copy">{themeDescription(snapshot.settings.themePreference)}</p>
            </section>
          </div>
        </details>

        {snapshot.devMode ? (
          <details className="drawer-panel support-panel">
            <summary>
              <span>Support & diagnostics</span>
            </summary>
            <div className="drawer-body">
              <div className="support-actions">
                <button
                  className="button button-secondary"
                  disabled={busyAction === "logs"}
                  onClick={() => void handleOpenLogs()}
                  type="button"
                >
                  {busyAction === "logs" ? "Opening…" : "Open logs"}
                </button>
                <button
                  className="button button-secondary"
                  disabled={busyAction === "copy"}
                  onClick={() => void handleCopyDebugReport()}
                  type="button"
                >
                  {busyAction === "copy"
                    ? "Copying…"
                    : copiedReport
                      ? "Copied"
                      : "Copy debug report"}
                </button>
              </div>

              <div className="support-grid">
                <section className="drawer-section">
                  <PaneHeader subtitle="Local-only runtime details." title="Runtime" />
                  <dl className="detail-list">
                    <div>
                      <dt>Backend</dt>
                      <dd>{snapshot.platform.backendLabel}</dd>
                    </div>
                    <div>
                      <dt>Window count</dt>
                      <dd>{snapshot.windowCandidates.length.toString()}</dd>
                    </div>
                    <div>
                      <dt>Settings file</dt>
                      <dd>{snapshot.diagnostics.settingsFile}</dd>
                    </div>
                    <div>
                      <dt>Log file</dt>
                      <dd>{snapshot.diagnostics.logFile}</dd>
                    </div>
                  </dl>
                </section>

                <section className="drawer-section">
                  <PaneHeader
                    subtitle="Newest events first."
                    title={`Recent events (${snapshot.diagnostics.recentEvents.length})`}
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
  onSelect,
  selected,
}: {
  candidate: WindowDescriptor;
  lensStatus: AppSnapshot["lens"]["status"] | null;
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
              <StatusChip label="Minimized" status="neutral" />
            ) : null}
            {lensStatus ? (
              <StatusChip
                label={windowEffectLabel(lensStatus)}
                status={windowEffectTone(lensStatus)}
              />
            ) : null}
          </div>
        </div>
        <p className="window-subtitle">{executableName(candidate.executablePath)}</p>
      </button>
    </li>
  );
}

function SelectedWindowDetails({
  candidate,
  devMode,
}: {
  candidate: WindowDescriptor;
  devMode: boolean;
}) {
  return (
    <>
      <dl className="detail-list">
        <div>
          <dt>Title</dt>
          <dd>{candidate.title}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{windowStateLabel(candidate)}</dd>
        </div>
        <div>
          <dt>Application</dt>
          <dd>{executableName(candidate.executablePath)}</dd>
        </div>
      </dl>
      {devMode ? (
        <details className="inline-details">
          <summary>Advanced details</summary>
          <dl className="detail-list advanced-detail-list">
            <div>
              <dt>Executable path</dt>
              <dd>{candidate.executablePath ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Window class</dt>
              <dd>{candidate.windowClass ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Bounds</dt>
              <dd>{formatBounds(candidate)}</dd>
            </div>
            <div>
              <dt>Process</dt>
              <dd>{candidate.processId.toString()}</dd>
            </div>
            <div>
              <dt>Window ID</dt>
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
      executableName(candidate.executablePath),
      candidate.windowClass ?? "",
      candidate.attachmentState,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function presetCapability(capabilities: CapabilityDescriptor[], preset: VisualPreset) {
  switch (preset) {
    case "dark":
      return capabilityById(capabilities, "magnificationBackend");
    case "warmDim":
      return capabilityById(capabilities, "tintBackend");
    case "greyscaleInvert":
      return capabilityById(capabilities, "magnificationBackend");
  }
}

function capabilityById(capabilities: CapabilityDescriptor[], id: string): CapabilityDescriptor {
  return (
    capabilities.find((capability) => capability.id === id) ?? {
      id,
      label: id,
      status: "unsupported",
      summary: "This capability is not exposed by the current runtime.",
    }
  );
}

function applyButtonLabel(
  busyAction: BusyAction,
  preset: PresetDefinition | null,
  presetStatus: CapabilityStatus,
  selectedWindow: WindowDescriptor | null
) {
  if (busyAction === "apply") {
    return "Applying…";
  }

  if (!selectedWindow) {
    return "Choose a window";
  }

  if (!preset || presetStatus !== "available") {
    return `${preset?.label ?? "Effect"} not available yet`;
  }

  return `Apply ${preset.label}`;
}

function applyHint(
  selectedWindow: WindowDescriptor | null,
  presetCapability: CapabilityDescriptor | null,
  presetStatus: CapabilityStatus
) {
  if (!selectedWindow) {
    return "Select a window to continue.";
  }

  if (selectedWindow.attachmentState === "minimized") {
    return "This window is minimized. The effect will appear when it is back on screen.";
  }

  if (presetStatus !== "available") {
    return presetCapability?.summary ?? "This effect is not available in the current build.";
  }

  return "Ready to apply the selected effect to this window.";
}

function windowListSubtitle(totalCount: number, query: string) {
  if (query.trim()) {
    return `${totalCount} windows match.`;
  }

  return `${totalCount} windows shown. Updates automatically.`;
}

function executableName(path: string | null) {
  if (!path) {
    return "Executable unavailable";
  }

  return path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;
}

function formatBounds(candidate: WindowDescriptor) {
  return `${candidate.bounds.width}x${candidate.bounds.height} at ${candidate.bounds.left}, ${candidate.bounds.top}`;
}

function effectStatusLabel(status: AppSnapshot["lens"]["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "attached":
      return "Applied";
    case "suspended":
      return "Paused";
    case "detached":
      return "Off";
  }
}

function effectMessage(snapshot: AppSnapshot) {
  if (snapshot.lens.status === "attached" && snapshot.lens.activeTarget) {
    return `${presetLabel(snapshot.lens.activePreset)} is active on ${snapshot.lens.activeTarget.title}.`;
  }

  if (snapshot.lens.status === "pending" && snapshot.lens.activeTarget) {
    return `${presetLabel(snapshot.lens.activePreset)} will appear when ${snapshot.lens.activeTarget.title} is back on screen.`;
  }

  if (snapshot.lens.status === "suspended") {
    return snapshot.lens.activeTarget
      ? `${presetLabel(snapshot.lens.activePreset)} is paused for ${snapshot.lens.activeTarget.title}.`
      : "The current effect is paused.";
  }

  return "Choose how the selected window should look.";
}

function effectStatusChip(status: AppSnapshot["lens"]["status"]): StatusTone {
  switch (status) {
    case "pending":
      return "neutral";
    case "attached":
      return "available";
    case "suspended":
      return "neutral";
    case "detached":
      return "neutral";
  }
}

function levelToStatus(level: RuntimeEvent["level"]): CapabilityStatus {
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

function presetAvailabilityLabel(status: CapabilityStatus) {
  switch (status) {
    case "available":
      return "Available";
    case "experimental":
      return "Experimental";
    case "planned":
      return "Not available yet";
    case "unsupported":
      return "Unavailable";
  }
}

function themeOptionLabel(theme: ThemePreference | "light" | "dark" | "greyscale-invert") {
  switch (theme) {
    case "system":
      return "System";
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    case "greyscaleInvert":
    case "greyscale-invert":
      return "Greyscale Invert";
  }
}

function themeDescription(themePreference: ThemePreference) {
  if (themePreference === "system") {
    return "Follow the operating system theme.";
  }

  if (themePreference === "greyscaleInvert") {
    return "Use GlareMute's internal greyscale inverted appearance.";
  }

  return `Use the ${themeOptionLabel(themePreference)} appearance for GlareMute itself.`;
}

function windowStateLabel(candidate: WindowDescriptor) {
  switch (candidate.attachmentState) {
    case "available":
      return "Ready";
    case "minimized":
      return "Minimized; the effect appears once it is back on screen";
  }
}

function statusTone(status: CapabilityStatus): StatusTone {
  switch (status) {
    case "available":
    case "experimental":
    case "planned":
    case "unsupported":
      return status;
  }
}

function presetLabel(preset: VisualPreset | null) {
  switch (preset) {
    case "dark":
      return "Dark";
    case "warmDim":
      return "Warm Dim";
    case "greyscaleInvert":
      return "Greyscale Invert";
    case null:
      return "The selected effect";
  }
}

function visibleEffectPresets(presets: PresetDefinition[]) {
  return presets.filter((preset) => preset.id !== "warmDim");
}

function windowEffectLabel(status: AppSnapshot["lens"]["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "attached":
      return "Applied";
    case "suspended":
      return "Paused";
    case "detached":
      return "Off";
  }
}

function windowEffectTone(status: AppSnapshot["lens"]["status"]): StatusTone {
  switch (status) {
    case "attached":
      return "available";
    case "pending":
    case "suspended":
      return "neutral";
    case "detached":
      return "neutral";
  }
}

export default App;
