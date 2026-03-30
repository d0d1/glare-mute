import { startTransition, useEffect, useState } from "react";

import "./App.css";
import type {
  AppSnapshot,
  CapabilityDescriptor,
  CapabilityStatus,
  RuntimeEvent,
  ThemePreference,
  WindowDescriptor,
} from "./lib/contracts";
import { __resetMockDesktopClient, desktopClient } from "./lib/desktop-client";
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

        setErrorMessage(error instanceof Error ? error.message : "Failed to bootstrap GlareMute.");
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

  async function handleAttachWindow(windowId: string) {
    await updateSnapshot(() => desktopClient.attachWindow(windowId, "greyscaleInvert"), "attach");
  }

  async function handleDetachLens() {
    await updateSnapshot(() => desktopClient.detachLens(), "detach");
  }

  async function handleOpenLogs() {
    setBusyAction("logs");
    setErrorMessage(null);

    try {
      await desktopClient.openLogsDirectory();
      await desktopClient.appendFrontendLog("info", "ui", "log directory opened from dashboard");
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
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to copy the diagnostics report."
      );
    } finally {
      setBusyAction(null);
    }
  }

  if (!snapshot) {
    return (
      <div className="app-shell">
        <div className="app-frame">
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow">Booting diagnostics shell</span>
              <h1>Preparing the accessibility lens.</h1>
              <p>
                GlareMute starts by loading theme preferences, platform capability probes, and the
                local diagnostics surface so agents can debug failures without asking you to probe
                the app manually.
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const windowPicker = capabilityById(snapshot.platform.capabilities, "windowPicker");
  const transformCapability = capabilityById(
    snapshot.platform.capabilities,
    "magnificationBackend"
  );

  return (
    <div className="app-shell">
      <div className="app-frame">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Windows accessibility lens</span>
            <h1>Per-window relief, not system-wide distortion.</h1>
            <p>
              The v1 shell is built around a tray-first workflow, a zero-lag tint path, and a
              separate transform path for invert-style presets. This preview shares the same command
              contract as the Tauri runtime, so agents can test it in Playwright without touching
              your browser session.
            </p>
            <div className="hero-meta">
              <MetaPill label="Runtime" value={snapshot.platform.backendLabel} />
              <MetaPill label="Version" value={snapshot.appVersion} />
              <MetaPill label="Theme" value={themeLabel(snapshot.settings.themePreference)} />
              <MetaPill label="Lens" value={lensLabel(snapshot.lens.status)} />
            </div>
          </div>

          <aside className="theme-card">
            <div className="panel-header">
              <h2>Theme discipline</h2>
              <code className="mono">{effectiveTheme}</code>
            </div>
            <p>
              Default to the system theme, but keep a manual override. An accessibility tool should
              not force the same eye-strain patterns it is trying to fix.
            </p>
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
            <p className="mono">
              Effective theme: {effectiveTheme}. Emergency suspend: tray menu or dashboard toggle.
            </p>
          </aside>
        </section>

        <section className="dashboard">
          {errorMessage ? <div className="panel alert">{errorMessage}</div> : null}

          <Panel span={12} subtitle="Agent-first surface area" title="Session overview">
            <div className="stats-grid">
              <StatCard
                detail="Tint and transform presets come from the shared Rust contract."
                label="Presets"
                value={snapshot.presets.length.toString()}
              />
              <StatCard
                detail="Visible top-level windows can be refreshed and attached explicitly."
                label="Windows"
                value={snapshot.windowCandidates.length.toString()}
              />
              <StatCard
                detail="Backend and UI events stay visible in-app for fast diagnosis."
                label="Recent events"
                value={snapshot.diagnostics.recentEvents.length.toString()}
              />
              <StatCard
                detail="The first native Windows slice targets Greyscale Invert end to end."
                label="Target"
                value={snapshot.lens.activeTarget?.title ?? "Detached"}
              />
            </div>
          </Panel>

          <Panel
            span={7}
            subtitle="This is where the product will succeed or disappoint"
            title="Effect backends"
          >
            <div className="capability-grid">
              {snapshot.platform.capabilities.map((capability) => (
                <CapabilityCard capability={capability} key={capability.id} />
              ))}
            </div>
          </Panel>

          <Panel span={5} subtitle="Everything needed to inspect a failure" title="Quick actions">
            <div className="action-grid">
              <ActionCard
                actionLabel={busyAction === "refresh" ? "Refreshing…" : "Refresh"}
                actionState={windowPicker.status}
                description={windowPicker.summary}
                disabled={busyAction === "refresh"}
                onAction={() => void handleRefreshWindows()}
                title="Refresh Windows"
              />
              <ActionCard
                actionLabel={busyAction === "suspend" ? "Working…" : "Toggle"}
                actionState={snapshot.lens.status === "suspended" ? "experimental" : "available"}
                description="Immediate safety toggle that hides the active lens without detaching it."
                onAction={() => void handleSuspendToggle()}
                title={snapshot.diagnostics.suspended ? "Resume Lens" : "Suspend Lens"}
              />
              <ActionCard
                actionLabel={busyAction === "detach" ? "Detaching…" : "Detach"}
                actionState={snapshot.lens.activeTarget ? "available" : "planned"}
                description="Drops the current attachment and hides the magnifier host window."
                disabled={!snapshot.lens.activeTarget || busyAction === "detach"}
                onAction={() => void handleDetachLens()}
                title="Detach Lens"
              />
              <ActionCard
                actionLabel={busyAction === "logs" ? "Opening…" : "Open logs"}
                actionState="available"
                description="Opens the local-only diagnostics folder used by the desktop shell."
                onAction={() => void handleOpenLogs()}
                title="Open Logs Directory"
              />
              <ActionCard
                actionLabel={busyAction === "copy" ? "Copying…" : copiedReport ? "Copied" : "Copy"}
                actionState="available"
                description="Copies a structured report with settings, capabilities, and recent events."
                onAction={() => void handleCopyDebugReport()}
                title="Copy Debug Report"
              />
            </div>
            <div className="button-row">
              <button
                className="button button-secondary"
                onClick={() => {
                  __resetMockDesktopClient();
                  window.location.reload();
                }}
                type="button"
              >
                Reset preview state
              </button>
              <span className="mono">
                Active backend: {snapshot.lens.backendLabel} ({transformCapability.status})
              </span>
            </div>
          </Panel>

          <Panel
            span={6}
            subtitle="This is the native path that makes the first IRPF test possible"
            title="Window Picker"
          >
            {snapshot.windowCandidates.length > 0 ? (
              <div className="profile-grid">
                {snapshot.windowCandidates.map((candidate) => (
                  <WindowCandidateCard
                    busy={busyAction === "attach"}
                    candidate={candidate}
                    key={candidate.windowId}
                    onAttach={() => void handleAttachWindow(candidate.windowId)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No visible attachable windows were detected. Bring IRPF to the desktop, then
                refresh.
              </div>
            )}
          </Panel>

          <Panel
            span={6}
            subtitle="State stays explicit so agents and humans can diagnose attachment failures fast"
            title="Active Lens"
          >
            <div className="profile-card">
              <div className="panel-header">
                <strong>{snapshot.lens.activeTarget?.title ?? "No active target"}</strong>
                <StatusChip status={lensStatusChip(snapshot.lens.status)} />
              </div>
              <p>{snapshot.lens.summary}</p>
              {snapshot.lens.activeTarget ? (
                <dl className="key-value">
                  <div>
                    <dt>Preset</dt>
                    <dd>{snapshot.lens.activePreset ?? "none"}</dd>
                  </div>
                  <div>
                    <dt>Window</dt>
                    <dd>{snapshot.lens.activeTarget.windowId}</dd>
                  </div>
                  <div>
                    <dt>Executable</dt>
                    <dd>{snapshot.lens.activeTarget.executablePath ?? "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt>Class</dt>
                    <dd>{snapshot.lens.activeTarget.windowClass ?? "Unavailable"}</dd>
                  </div>
                </dl>
              ) : (
                <div className="empty-state">
                  Attach `Greyscale Invert` to a visible window to activate the first native slice.
                </div>
              )}
            </div>
          </Panel>

          <Panel
            span={12}
            subtitle="Shared by the mock shell and Tauri runtime"
            title="Preset catalog"
          >
            <div className="profile-grid">
              {snapshot.presets.map((preset) => (
                <div className="profile-card" key={preset.id}>
                  <div className="panel-header">
                    <strong>{preset.label}</strong>
                    <span
                      className="status-chip"
                      data-status={
                        preset.id === "greyscaleInvert"
                          ? "available"
                          : preset.family === "tint"
                            ? "planned"
                            : "experimental"
                      }
                    >
                      {preset.family}
                    </span>
                  </div>
                  <p>{preset.summary}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel span={12} subtitle="Recent signals for local debugging" title="Diagnostics">
            <div className="diagnostic-grid">
              <div className="diagnostic-card">
                <div className="panel-header">
                  <h2>Paths</h2>
                  <code className="mono">{snapshot.platform.target}</code>
                </div>
                <dl className="key-value">
                  <div>
                    <dt>Settings file</dt>
                    <dd>{snapshot.diagnostics.settingsFile}</dd>
                  </div>
                  <div>
                    <dt>Log file</dt>
                    <dd>{snapshot.diagnostics.logFile}</dd>
                  </div>
                  <div>
                    <dt>Backend</dt>
                    <dd>{snapshot.platform.backendId}</dd>
                  </div>
                </dl>
              </div>

              <div className="diagnostic-card">
                <div className="panel-header">
                  <h2>Recent events</h2>
                  <code className="mono">{snapshot.diagnostics.recentEvents.length}</code>
                </div>
                <div className="log-list">
                  {snapshot.diagnostics.recentEvents.slice(0, 6).map((event) => (
                    <LogItem event={event} key={`${event.timestamp}-${event.message}`} />
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function Panel({
  children,
  span,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  span: 5 | 6 | 7 | 12;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="panel" data-span={span.toString()}>
      <div className="panel-header">
        <h2>{title}</h2>
        <span className="mono">{subtitle}</span>
      </div>
      {children}
    </section>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="pill">
      <strong>{label}</strong>
      <span>{value}</span>
    </span>
  );
}

function StatCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <article className="stat-card">
      <span className="mono">{label}</span>
      <strong className="stat-value">{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function CapabilityCard({ capability }: { capability: CapabilityDescriptor }) {
  return (
    <article className="capability-card">
      <div className="panel-header">
        <strong>{capability.label}</strong>
        <StatusChip status={capability.status} />
      </div>
      <p>{capability.summary}</p>
    </article>
  );
}

function ActionCard({
  actionLabel,
  actionState,
  description,
  disabled = false,
  onAction,
  title,
}: {
  actionLabel: string;
  actionState: CapabilityStatus;
  description: string;
  disabled?: boolean;
  onAction?: () => void;
  title: string;
}) {
  return (
    <article className="action-card">
      <div className="panel-header">
        <strong>{title}</strong>
        <StatusChip status={actionState} />
      </div>
      <p>{description}</p>
      <button
        className={`button ${disabled ? "button-secondary" : ""}`.trim()}
        disabled={disabled}
        onClick={onAction}
        type="button"
      >
        {actionLabel}
      </button>
    </article>
  );
}

function WindowCandidateCard({
  busy,
  candidate,
  onAttach,
}: {
  busy: boolean;
  candidate: WindowDescriptor;
  onAttach: () => void;
}) {
  return (
    <article className="profile-card">
      <div className="panel-header">
        <strong>{candidate.title}</strong>
        <StatusChip status={candidate.isForeground ? "available" : "experimental"} />
      </div>
      <p>
        {candidate.executablePath ?? "Executable unavailable"}.{" "}
        {candidate.windowClass ? `Class: ${candidate.windowClass}. ` : ""}
        Bounds: {candidate.bounds.width}x{candidate.bounds.height} at {candidate.bounds.left},
        {candidate.bounds.top}.
      </p>
      <div className="button-row">
        <code className="mono">{candidate.windowId}</code>
        <button className="button" disabled={busy} onClick={onAttach} type="button">
          {busy ? "Attaching…" : "Attach Greyscale Invert"}
        </button>
      </div>
    </article>
  );
}

function LogItem({ event }: { event: RuntimeEvent }) {
  return (
    <article className="log-item">
      <div className="log-meta">
        <StatusChip status={levelToStatus(event.level)} />
        <span>{event.source}</span>
        <span>{event.timestamp}</span>
      </div>
      <p>{event.message}</p>
    </article>
  );
}

function StatusChip({ status }: { status: CapabilityStatus }) {
  return (
    <span className="status-chip" data-status={status}>
      {status}
    </span>
  );
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

function themeLabel(theme: ThemePreference): string {
  switch (theme) {
    case "system":
      return "System default";
    case "light":
      return "Light override";
    case "dark":
      return "Dark override";
  }
}

function lensLabel(status: AppSnapshot["lens"]["status"]): string {
  switch (status) {
    case "detached":
      return "Detached";
    case "attached":
      return "Attached";
    case "suspended":
      return "Suspended";
  }
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

export default App;
