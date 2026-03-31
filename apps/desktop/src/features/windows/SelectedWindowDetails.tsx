import type { WindowDescriptor } from "../../lib/contracts";
import type { Messages } from "../../lib/i18n";
import { executableName, formatBounds } from "./window-utils";

export function SelectedWindowDetails({
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
