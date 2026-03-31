import { PaneHeader } from "../../components/PaneHeader";
import type { AppSnapshot } from "../../lib/contracts";
import type { Messages } from "../../lib/i18n";
import { LogItem } from "./LogItem";

type BusyAction = "apply" | "copy" | "logs" | "settings" | "turnOff" | null;

export function SupportPanel({
  busyAction,
  copiedReport,
  messages,
  onCopyDebugReport,
  onOpenLogs,
  snapshot,
}: {
  busyAction: BusyAction;
  copiedReport: boolean;
  messages: Messages;
  onCopyDebugReport: () => void;
  onOpenLogs: () => void;
  snapshot: AppSnapshot;
}) {
  return (
    <details className="drawer-panel support-panel">
      <summary>
        <span>{messages.supportDiagnostics}</span>
      </summary>
      <div className="drawer-body">
        <div className="support-actions">
          <button
            className="button button-secondary"
            disabled={busyAction === "logs"}
            onClick={onOpenLogs}
            type="button"
          >
            {busyAction === "logs" ? messages.opening : messages.openLogs}
          </button>
          <button
            className="button button-secondary"
            disabled={busyAction === "copy"}
            onClick={onCopyDebugReport}
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
  );
}
