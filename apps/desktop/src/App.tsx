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

type BusyAction = "attach" | "copy" | "detach" | "logs" | "refresh" | "suspend" | "theme" | null;
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

    setSelectedPreset((current) =>
      snapshot.presets.some((preset) => preset.id === current)
        ? current
        : (snapshot.lens.activePreset ?? DEFAULT_PRESET)
    );
  }, [snapshot]);

  const allWindowCandidates = snapshot?.windowCandidates ?? [];
  const filteredWindowCandidates = filterWindowCandidates(allWindowCandidates, windowQuery);
  const availableWindowCandidates = filteredWindowCandidates.filter(
    (candidate) => candidate.attachmentState === "available"
  );
  const unavailableWindowCandidates = filteredWindowCandidates.filter(
    (candidate) => candidate.attachmentState !== "available"
  );

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const nextCandidates = filterWindowCandidates(snapshot.windowCandidates, windowQuery);
    const nextAvailableCandidates = nextCandidates.filter(
      (candidate) => candidate.attachmentState === "available"
    );
    const nextUnavailableCandidates = nextCandidates.filter(
      (candidate) => candidate.attachmentState !== "available"
    );

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

      return nextAvailableCandidates[0]?.windowId ?? nextUnavailableCandidates[0]?.windowId ?? null;
    });
  }, [snapshot, windowQuery]);

  const selectedWindow =
    allWindowCandidates.find((candidate) => candidate.windowId === selectedWindowId) ?? null;
  const activeTarget = snapshot?.lens.activeTarget ?? null;
  const selectedPresetDefinition =
    snapshot?.presets.find((preset) => preset.id === selectedPreset) ?? null;
  const selectedPresetCapability = snapshot
    ? presetCapability(snapshot.platform.capabilities, selectedPreset)
    : null;
  const selectedPresetStatus = selectedPresetCapability?.status ?? "unsupported";
  const selectedWindowAttachable = selectedWindow?.attachmentState === "available";
  const canAttachSelectedWindow =
    Boolean(selectedWindow) &&
    selectedWindowAttachable &&
    selectedPresetStatus === "available" &&
    busyAction !== "attach";

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
    await updateSnapshot(() => desktopClient.toggleSuspend(), "suspend");
  }

  async function handleRefreshWindows() {
    await updateSnapshot(() => desktopClient.refreshWindowCandidates(), "refresh");
  }

  async function handleAttachSelectedWindow() {
    if (!selectedWindow || !canAttachSelectedWindow) {
      return;
    }

    await updateSnapshot(
      () => desktopClient.attachWindow(selectedWindow.windowId, selectedPreset),
      "attach"
    );
  }

  async function handleDetachLens() {
    await updateSnapshot(() => desktopClient.detachLens(), "detach");
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
            Choose a window and apply a relief effect without changing the rest of the desktop.
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
              subtitle={windowListSubtitle(
                availableWindowCandidates.length,
                unavailableWindowCandidates.length,
                windowQuery
              )}
              title="Available windows"
            />

            <div className="toolbar">
              <input
                aria-label="Filter windows"
                className="search-input"
                onChange={(event) => setWindowQuery(event.target.value)}
                placeholder="Filter by title, app, or class"
                type="search"
                value={windowQuery}
              />
              <button
                className="button button-secondary"
                disabled={busyAction === "refresh"}
                onClick={() => void handleRefreshWindows()}
                type="button"
              >
                {busyAction === "refresh" ? "Refreshing…" : "Refresh list"}
              </button>
            </div>

            {filteredWindowCandidates.length > 0 ? (
              <div className="window-groups">
                {availableWindowCandidates.length > 0 ? (
                  <WindowGroup
                    ariaLabel="Windows ready to attach"
                    candidates={availableWindowCandidates}
                    heading="Ready now"
                    onSelect={setSelectedWindowId}
                    selectedWindowId={selectedWindowId}
                    activeWindowId={activeTarget?.windowId ?? null}
                  />
                ) : null}

                {unavailableWindowCandidates.length > 0 ? (
                  <WindowGroup
                    ariaLabel="Windows that need to be restored first"
                    candidates={unavailableWindowCandidates}
                    heading="Restore first"
                    onSelect={setSelectedWindowId}
                    selectedWindowId={selectedWindowId}
                    activeWindowId={activeTarget?.windowId ?? null}
                  />
                ) : null}
              </div>
            ) : (
              <div className="empty-state">
                {allWindowCandidates.length === 0
                  ? "No windows are available yet. Bring the target app to the desktop and refresh the list."
                  : "No windows match the current filter."}
              </div>
            )}
          </section>

          <section className="workflow-pane lens-pane">
            <div className="lens-header">
              <PaneHeader subtitle={lensMessage(snapshot)} title="Lens" />
              <StatusChip
                label={lensLabel(snapshot.lens.status)}
                status={lensStatusChip(snapshot.lens.status)}
              />
            </div>

            <section className="pane-section">
              <label className="field-label" htmlFor="effect-select">
                Effect
              </label>
              <select
                className="field-select"
                id="effect-select"
                onChange={(event) => setSelectedPreset(event.target.value as VisualPreset)}
                value={selectedPreset}
              >
                {snapshot.presets.map((preset) => (
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

            <section className="pane-section">
              <dl className="detail-list">
                <div>
                  <dt>Selected window</dt>
                  <dd>{selectedWindow?.title ?? "No window selected"}</dd>
                </div>
                <div>
                  <dt>Attached window</dt>
                  <dd>{activeTarget?.title ?? "No window attached"}</dd>
                </div>
                <div>
                  <dt>Safety hotkey</dt>
                  <dd>{snapshot.settings.panicHotkey}</dd>
                </div>
              </dl>
            </section>

            <section className="pane-section action-section">
              <button
                className="button"
                disabled={!canAttachSelectedWindow}
                onClick={() => void handleAttachSelectedWindow()}
                type="button"
              >
                {attachButtonLabel(
                  busyAction,
                  selectedPresetDefinition,
                  selectedPresetStatus,
                  selectedWindow
                )}
              </button>
              <p className="body-copy action-hint">
                {attachHint(selectedWindow, selectedPresetCapability, selectedPresetStatus)}
              </p>
              <div className="button-row">
                <button
                  className="button button-secondary"
                  disabled={busyAction === "suspend"}
                  onClick={() => void handleSuspendToggle()}
                  type="button"
                >
                  {busyAction === "suspend"
                    ? "Working…"
                    : snapshot.diagnostics.suspended
                      ? "Resume lens"
                      : "Suspend lens"}
                </button>
                <button
                  className="button button-secondary"
                  disabled={!activeTarget || busyAction === "detach"}
                  onClick={() => void handleDetachLens()}
                  type="button"
                >
                  {busyAction === "detach" ? "Detaching…" : "Detach lens"}
                </button>
              </div>
            </section>
          </section>

          <aside className="workflow-pane details-pane">
            <PaneHeader
              subtitle="The current selection is what Attach uses."
              title="Window details"
            />
            {selectedWindow ? (
              <SelectedWindowDetails candidate={selectedWindow} />
            ) : (
              <div className="empty-state">
                Select a window from the list to inspect it and attach the lens.
              </div>
            )}
          </aside>
        </main>

        <details className="drawer-panel settings-panel">
          <summary>
            <span>Settings</span>
            <span className="mono">
              {themeSummary(snapshot.settings.themePreference, effectiveTheme)}
            </span>
          </summary>
          <div className="drawer-body">
            <section className="drawer-section">
              <PaneHeader
                subtitle="GlareMute supports its own appearance modes natively, including Greyscale Invert."
                title="Theme"
              />
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
              <p className="body-copy">
                {themeDescription(snapshot.settings.themePreference, effectiveTheme)}
              </p>
            </section>
          </div>
        </details>

        {snapshot.devMode ? (
          <details className="drawer-panel support-panel">
            <summary>
              <span>Support & diagnostics</span>
              <span className="mono">{snapshot.platform.backendLabel}</span>
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

function PaneHeader({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <div className="pane-copy">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

function WindowGroup({
  activeWindowId,
  ariaLabel,
  candidates,
  heading,
  onSelect,
  selectedWindowId,
}: {
  activeWindowId: string | null;
  ariaLabel: string;
  candidates: WindowDescriptor[];
  heading: string;
  onSelect: (windowId: string) => void;
  selectedWindowId: string | null;
}) {
  return (
    <section className="window-group">
      <div className="group-heading">
        <h3>{heading}</h3>
        <span className="mono">{candidates.length}</span>
      </div>
      <ul aria-label={ariaLabel} className="window-list">
        {candidates.map((candidate) => (
          <WindowRow
            active={activeWindowId === candidate.windowId}
            candidate={candidate}
            key={candidate.windowId}
            onSelect={() => onSelect(candidate.windowId)}
            selected={selectedWindowId === candidate.windowId}
          />
        ))}
      </ul>
    </section>
  );
}

function WindowRow({
  active,
  candidate,
  onSelect,
  selected,
}: {
  active: boolean;
  candidate: WindowDescriptor;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <li
      className="window-row"
      data-attachable={candidate.attachmentState === "available"}
      data-selected={selected}
    >
      <button aria-selected={selected} className="window-select" onClick={onSelect} type="button">
        <div className="window-title-line">
          <strong className="window-title">{candidate.title}</strong>
        </div>
        <p className="window-subtitle">
          {executableName(candidate.executablePath)}
          {candidate.windowClass ? ` • ${candidate.windowClass}` : ""}
          {candidate.attachmentState === "minimized" ? " • Restore to attach" : ""}
        </p>
      </button>
      <div className="window-state">
        {candidate.attachmentState === "minimized" ? (
          <StatusChip label="Minimized" status="neutral" />
        ) : null}
        {candidate.isForeground ? <StatusChip label="Foreground" status="experimental" /> : null}
        {active ? <StatusChip label="Attached" status="available" /> : null}
      </div>
    </li>
  );
}

function SelectedWindowDetails({ candidate }: { candidate: WindowDescriptor }) {
  return (
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
    case "darken":
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

function attachButtonLabel(
  busyAction: BusyAction,
  preset: PresetDefinition | null,
  presetStatus: CapabilityStatus,
  selectedWindow: WindowDescriptor | null
) {
  if (busyAction === "attach") {
    return "Attaching…";
  }

  if (!selectedWindow) {
    return "Choose a window";
  }

  if (selectedWindow.attachmentState !== "available") {
    return "Restore window to attach";
  }

  if (!preset || presetStatus !== "available") {
    return `${preset?.label ?? "Effect"} not available yet`;
  }

  return `Attach ${preset.label}`;
}

function attachHint(
  selectedWindow: WindowDescriptor | null,
  presetCapability: CapabilityDescriptor | null,
  presetStatus: CapabilityStatus
) {
  if (!selectedWindow) {
    return "Select a window to continue.";
  }

  if (selectedWindow.attachmentState === "minimized") {
    return "Restore this window before attaching the lens.";
  }

  if (presetStatus !== "available") {
    return presetCapability?.summary ?? "This effect is not available in the current build.";
  }

  return "Ready to attach the selected effect to this window.";
}

function windowListSubtitle(availableCount: number, unavailableCount: number, query: string) {
  if (query.trim()) {
    return `${availableCount} ready now, ${unavailableCount} restore first.`;
  }

  if (unavailableCount > 0) {
    return `${availableCount} ready now. ${unavailableCount} minimized windows stay listed below.`;
  }

  return `${availableCount} ready now.`;
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

function lensLabel(status: AppSnapshot["lens"]["status"]) {
  switch (status) {
    case "attached":
      return "Attached";
    case "suspended":
      return "Suspended";
    case "detached":
      return "Detached";
  }
}

function lensMessage(snapshot: AppSnapshot) {
  if (snapshot.lens.status === "attached" && snapshot.lens.activeTarget) {
    return `Attached to ${snapshot.lens.activeTarget.title}.`;
  }

  if (snapshot.lens.status === "suspended") {
    return snapshot.lens.activeTarget
      ? `Paused while ${snapshot.lens.activeTarget.title} stays selected.`
      : "Paused before any window is attached.";
  }

  return "Select a window and choose an effect to attach.";
}

function lensStatusChip(status: AppSnapshot["lens"]["status"]): CapabilityStatus {
  switch (status) {
    case "attached":
      return "available";
    case "suspended":
      return "experimental";
    case "detached":
      return "planned";
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

function themeSummary(
  themePreference: ThemePreference,
  effectiveTheme: "light" | "dark" | "greyscale-invert"
) {
  if (themePreference === "system") {
    return `Theme: System (${themeOptionLabel(effectiveTheme)})`;
  }

  return `Theme: ${themeOptionLabel(themePreference)}`;
}

function themeDescription(
  themePreference: ThemePreference,
  effectiveTheme: "light" | "dark" | "greyscale-invert"
) {
  if (themePreference === "system") {
    return `Follow the operating system theme. Current result: ${themeOptionLabel(effectiveTheme)}.`;
  }

  if (themePreference === "greyscaleInvert") {
    return "Greyscale Invert is the native in-app version of the current transform effect.";
  }

  return `Use the ${themeOptionLabel(themePreference)} appearance for GlareMute itself.`;
}

function windowStateLabel(candidate: WindowDescriptor) {
  switch (candidate.attachmentState) {
    case "available":
      return "Ready to attach";
    case "minimized":
      return "Minimized; restore before attaching";
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

export default App;
