import { PaneHeader } from "../../components/PaneHeader";
import { StatusChip } from "../../components/StatusChip";
import type { AppSnapshot, ProfileRule, VisualPreset, WindowDescriptor } from "../../lib/contracts";
import type { Messages } from "../../lib/i18n";
import { SelectedWindowDetails } from "../windows/SelectedWindowDetails";
import { SavedProfilesSection } from "./SavedProfilesSection";
import { effectMessage, effectStatusChip, effectStatusLabel } from "./effect-utils";

type BusyAction = "saveProfile" | "profiles" | "copy" | "logs" | "settings" | null;

export function EffectPane({
  busyAction,
  canSaveSelectedWindow,
  messages,
  onPresetChange,
  onRemoveProfile,
  onSaveProfile,
  onToggleProfile,
  selectedPreset,
  selectedPresetDefinition,
  selectedWindowHasSavedProfile,
  selectedWindow,
  savedProfiles,
  snapshot,
}: {
  busyAction: BusyAction;
  canSaveSelectedWindow: boolean;
  messages: Messages;
  onPresetChange: (preset: VisualPreset) => void;
  onRemoveProfile: (profileId: string) => void;
  onSaveProfile: () => void;
  onToggleProfile: (profileId: string, enabled: boolean) => void;
  selectedPreset: VisualPreset;
  selectedPresetDefinition: AppSnapshot["presets"][number] | null;
  selectedWindowHasSavedProfile: boolean;
  selectedWindow: WindowDescriptor | null;
  savedProfiles: {
    profile: ProfileRule;
    runtime: AppSnapshot["lens"]["profileSnapshots"][number] | null;
  }[];
  snapshot: AppSnapshot;
}) {
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
          disabled={!canSaveSelectedWindow}
          onClick={onSaveProfile}
          type="button"
        >
          {messages.saveProfileButton({
            busy: busyAction === "saveProfile",
            hasPreset: Boolean(selectedPresetDefinition),
            hasSavedProfile: selectedWindowHasSavedProfile,
            hasSelectedWindow: Boolean(selectedWindow),
            presetLabel: selectedPresetDefinition?.label ?? null,
          })}
        </button>
        <p className="body-copy action-hint">
          {messages.saveProfileHint({
            attachmentState: selectedWindow?.attachmentState ?? null,
            hasSavedProfile: selectedWindowHasSavedProfile,
          })}
        </p>
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

      <SavedProfilesSection
        busyAction={busyAction}
        messages={messages}
        onRemoveProfile={onRemoveProfile}
        onToggleProfile={onToggleProfile}
        profiles={savedProfiles}
      />
    </section>
  );
}
