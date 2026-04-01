import { PaneHeader } from "../../components/PaneHeader";
import type { AppSnapshot } from "../../lib/contracts";
import type { Messages } from "../../lib/i18n";
import { WindowRow } from "./WindowRow";
import { windowLensStatus, windowListSubtitle } from "./window-utils";

export function WindowPane({
  allWindowCandidates,
  coveredWindowIds,
  filteredWindowCandidates,
  messages,
  onSelectWindow,
  selectedWindowId,
  windowQuery,
  onWindowQueryChange,
}: {
  allWindowCandidates: AppSnapshot["windowCandidates"];
  coveredWindowIds: Set<string>;
  filteredWindowCandidates: AppSnapshot["windowCandidates"];
  messages: Messages;
  onSelectWindow: (logicalTargetId: string) => void;
  selectedWindowId: string | null;
  windowQuery: string;
  onWindowQueryChange: (value: string) => void;
}) {
  return (
    <section className="workflow-pane window-pane">
      <PaneHeader
        subtitle={windowListSubtitle(messages, filteredWindowCandidates.length, windowQuery)}
        title={messages.availableWindows}
      />

      <input
        aria-label={messages.filterWindows}
        className="search-input"
        onChange={(event) => onWindowQueryChange(event.target.value)}
        placeholder={messages.filterWindowsPlaceholder}
        type="search"
        value={windowQuery}
      />

      {filteredWindowCandidates.length > 0 ? (
        <ul aria-label={messages.availableWindows} className="window-list">
          {filteredWindowCandidates.map((candidate) => (
            <WindowRow
              candidate={candidate}
              key={candidate.logicalTargetId}
              lensStatus={windowLensStatus(candidate, coveredWindowIds)}
              messages={messages}
              onSelect={() => onSelectWindow(candidate.logicalTargetId)}
              selected={selectedWindowId === candidate.logicalTargetId}
            />
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          {allWindowCandidates.length === 0 ? messages.noWindowsAvailable : messages.noWindowsMatch}
        </div>
      )}
    </section>
  );
}
