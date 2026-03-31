import { StatusChip } from "../../components/StatusChip";
import type { AppSnapshot, WindowDescriptor } from "../../lib/contracts";
import type { Messages } from "../../lib/i18n";
import { windowEffectTone } from "../effects/effect-utils";
import { executableName } from "./window-utils";

export function WindowRow({
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
