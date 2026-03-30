import { startTransition, useEffect, useState } from "react";

import "./App.css";
import type {
  AppSnapshot,
  CapabilityStatus,
  RuntimeEvent,
  ThemePreference,
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

const THEME_OPTIONS: Array<{ hint: string; label: string; value: ThemePreference }> = [
  { hint: "Follow the operating system theme.", label: "System", value: "system" },
  { hint: "Force a bright theme only if needed.", label: "Light", value: "light" },
  { hint: "Force the shell into the darker variant.", label: "Dark", value: "dark" },
];

function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [prefersDark, setPrefersDark] = useState(() => getSystemPrefersDark());
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
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
      `dashboard hydrated with ${snapshot.platform.backendId}`
    );
  }, [snapshot]);

  const filteredWindowCandidates = snapshot
    ? filterWindowCandidates(snapshot.windowCandidates, windowQuery)
    : [];

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const nextCandidates = filterWindowCandidates(snapshot.windowCandidates, windowQuery);

    setSelectedWindowId((current) => {
      if (current && nextCandidates.some((entry) => entry.windowId === current)) {
        return current;
      }

      const activeId = snapshot.lens.activeTarget?.windowId;
      if (activeId && nextCandidates.some((entry) => entry.windowId === activeId)) {
        return activeId;
      }

      return nextCandidates[0]?.windowId ?? null;
    });
  }, [snapshot, windowQuery]);

  const selectedWindow =
    snapshot?.windowCandidates.find((entry) => entry.windowId === selectedWindowId) ?? null;
  const activeTarget = snapshot?.lens.activeTarget ?? null;

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
    if (!selectedWindow) {
      return;
    }

    await updateSnapshot(
      () => desktopClient.attachWindow(selectedWindow.windowId, "greyscaleInvert"),
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
          <section className="panel-card loading-card">
            <p className="brand-mark">GlareMute</p>
            <h1>Opening workspace…</h1>
            <p className="body-copy">
              Loading the current session, theme preference, and window list.
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="app-header">
          <div className="brand-block">
            <p className="brand-mark">GlareMute</p>
            <h1>Greyscale Invert</h1>
            <p className="app-subtitle">
              Select one visible window, attach the lens, and keep the rest of the desktop
              unchanged.
            </p>
          </div>

          <section className="preferences-card" aria-label="Appearance">
            <SectionHeading
              subtitle="System default unless you choose otherwise."
              title="Appearance"
            />
            <fieldset className="theme-toggle">
              <legend className="sr-only">Theme preference</legend>
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className="theme-button"
                  data-active={snapshot.settings.themePreference === option.value}
                  aria-pressed={snapshot.settings.themePreference === option.value}
                  disabled={busyAction === "theme"}
                  onClick={() => void handleThemeChange(option.value)}
                  title={option.hint}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </fieldset>
            <p className="body-copy">
              Effective theme: <strong>{themeLabel(effectiveTheme)}</strong>.
            </p>
          </section>
        </header>

        {errorMessage ? (
          <output aria-live="polite" className="alert">
            {errorMessage}
          </output>
        ) : null}

        <main className="workspace">
          <section className="panel-card window-panel">
            <div className="section-toolbar">
              <SectionHeading
                subtitle={windowListSubtitle(
                  snapshot.windowCandidates.length,
                  filteredWindowCandidates.length,
                  windowQuery
                )}
                title="Visible windows"
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
            </div>

            {filteredWindowCandidates.length > 0 ? (
              <ul aria-label="Visible windows" className="window-list">
                {filteredWindowCandidates.map((candidate) => (
                  <WindowRow
                    active={activeTarget?.windowId === candidate.windowId}
                    candidate={candidate}
                    key={candidate.windowId}
                    onSelect={() => setSelectedWindowId(candidate.windowId)}
                    selected={selectedWindowId === candidate.windowId}
                  />
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                {snapshot.windowCandidates.length === 0
                  ? "No visible windows are available yet. Bring the target app to the desktop and refresh the list."
                  : "No windows match the current filter."}
              </div>
            )}
          </section>

          <aside className="sidebar-stack">
            <section className="panel-card">
              <div className="lens-summary">
                <SectionHeading subtitle={lensMessage(snapshot)} title="Lens" />
                <StatusChip
                  label={lensLabel(snapshot.lens.status)}
                  status={lensStatusChip(snapshot.lens.status)}
                />
              </div>

              <dl className="detail-list">
                <div>
                  <dt>Effect</dt>
                  <dd>Greyscale Invert</dd>
                </div>
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

              <div className="control-stack">
                <button
                  className="button"
                  disabled={!selectedWindow || busyAction === "attach"}
                  onClick={() => void handleAttachSelectedWindow()}
                  type="button"
                >
                  {busyAction === "attach" ? "Attaching…" : "Attach Greyscale Invert"}
                </button>
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
              </div>
            </section>

            <section className="panel-card">
              <SectionHeading
                subtitle="The current selection is what Attach uses."
                title="Selected window"
              />
              {selectedWindow ? (
                <SelectedWindowDetails candidate={selectedWindow} />
              ) : (
                <div className="empty-state">
                  Select a visible window from the list to inspect it and attach the lens.
                </div>
              )}
            </section>
          </aside>
        </main>

        <details className="support-panel">
          <summary>
            <span>Support & diagnostics</span>
            <span className="mono">{snapshot.platform.backendLabel}</span>
          </summary>
          <div className="support-body">
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
                {busyAction === "copy" ? "Copying…" : copiedReport ? "Copied" : "Copy debug report"}
              </button>
            </div>

            <div className="support-grid">
              <section className="support-card">
                <SectionHeading subtitle="Local-only runtime details." title="Runtime" />
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

              <section className="support-card">
                <SectionHeading
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
      </div>
    </div>
  );
}

function SectionHeading({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <div className="section-copy">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
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
    <li className="window-row" data-selected={selected}>
      <button aria-selected={selected} className="window-select" onClick={onSelect} type="button">
        <div className="window-title-line">
          <strong className="window-title">{candidate.title}</strong>
        </div>
        <p className="window-subtitle">
          {executableName(candidate.executablePath)}
          {candidate.windowClass ? ` • ${candidate.windowClass}` : ""}
          {` • ${candidate.bounds.width}x${candidate.bounds.height}`}
        </p>
      </button>
      <div className="window-state">
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
  status: CapabilityStatus;
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
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
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

  return "Select a window and attach Greyscale Invert.";
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

function themeLabel(theme: ThemePreference | "light" | "dark") {
  switch (theme) {
    case "system":
      return "System";
    case "light":
      return "Light";
    case "dark":
      return "Dark";
  }
}

function windowListSubtitle(total: number, filtered: number, query: string) {
  if (!query.trim()) {
    return `${total} visible ${total === 1 ? "window" : "windows"}.`;
  }

  return `Showing ${filtered} of ${total} visible windows.`;
}

export default App;
