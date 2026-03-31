import { PaneHeader } from "../../components/PaneHeader";
import { StatusChip } from "../../components/StatusChip";
import type { AppSnapshot, VisualPreset, WindowDescriptor } from "../../lib/contracts";
import type { Messages } from "../../lib/i18n";
import { SelectedWindowDetails } from "../windows/SelectedWindowDetails";
import { effectMessage, effectStatusChip, effectStatusLabel } from "./effect-utils";

type BusyAction = "apply" | "copy" | "logs" | "settings" | "turnOff" | null;

export function EffectPane({
  busyAction,
  canAttachSelectedWindow,
  messages,
  onAttach,
  onDetach,
  onPresetChange,
  selectedPreset,
  selectedPresetDefinition,
  selectedWindow,
  snapshot,
}: {
  busyAction: BusyAction;
  canAttachSelectedWindow: boolean;
  messages: Messages;
  onAttach: () => void;
  onDetach: () => void;
  onPresetChange: (preset: VisualPreset) => void;
  selectedPreset: VisualPreset;
  selectedPresetDefinition: AppSnapshot["presets"][number] | null;
  selectedWindow: WindowDescriptor | null;
  snapshot: AppSnapshot;
}) {
  const activeTarget = snapshot.lens.activeTarget;

  return (
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
          onChange={(event) => onPresetChange(event.target.value as VisualPreset)}
          value={selectedPreset}
        >
          {snapshot.presets
            .filter((preset) => preset.id !== "warmDim")
            .map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.id === selectedPresetDefinition?.id
                  ? selectedPresetDefinition.label
                  : messages.presetLabel(preset.id)}
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
          onClick={onAttach}
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
            onClick={onDetach}
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
  );
}
