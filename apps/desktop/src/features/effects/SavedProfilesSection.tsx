import { PaneHeader } from "../../components/PaneHeader";
import { StatusChip } from "../../components/StatusChip";
import type { AppSnapshot, ProfileRule } from "../../lib/contracts";
import type { Messages } from "../../lib/i18n";
import { effectStatusChip } from "./effect-utils";

type BusyAction = "saveProfile" | "profiles" | "copy" | "logs" | "settings" | null;

interface SavedProfileView {
  profile: ProfileRule;
  runtime: AppSnapshot["lens"]["profileSnapshots"][number] | null;
}

export function SavedProfilesSection({
  busyAction,
  messages,
  onRemoveProfile,
  onToggleProfile,
  profiles,
}: {
  busyAction: BusyAction;
  messages: Messages;
  onRemoveProfile: (profileId: string) => void;
  onToggleProfile: (profileId: string, enabled: boolean) => void;
  profiles: SavedProfileView[];
}) {
  return (
    <section className="pane-section saved-profiles-section">
      <PaneHeader
        subtitle={messages.savedAppsSubtitle(profiles.length)}
        title={messages.savedApps}
      />
      {profiles.length > 0 ? (
        <ul className="saved-profile-list">
          {profiles.map(({ profile, runtime }) => {
            const matchCount = runtime?.matchingTargets.length ?? 0;
            const visibleCount =
              runtime?.matchingTargets.filter((target) => target.attachmentState === "available")
                .length ?? 0;
            const lensStatus = !profile.enabled
              ? "detached"
              : visibleCount > 0
                ? "attached"
                : "pending";

            return (
              <li className="saved-profile-card" key={profile.id}>
                <div className="group-heading">
                  <div className="pane-copy">
                    <h3>{profile.label || profile.executablePath}</h3>
                    <p className="body-copy">
                      {messages.savedProfileSummary({
                        enabled: profile.enabled,
                        matchCount,
                        presetLabel: messages.presetLabel(profile.preset),
                        visibleCount,
                      })}
                    </p>
                  </div>
                  <StatusChip
                    label={messages.windowEffectLabel(lensStatus)}
                    status={effectStatusChip(lensStatus)}
                  />
                </div>

                <div className="saved-profile-actions">
                  <button
                    className="button button-secondary"
                    disabled={busyAction === "profiles"}
                    onClick={() => onToggleProfile(profile.id, !profile.enabled)}
                    type="button"
                  >
                    {profile.enabled ? messages.disable : messages.enable}
                  </button>
                  <button
                    className="button button-secondary"
                    disabled={busyAction === "profiles"}
                    onClick={() => onRemoveProfile(profile.id)}
                    type="button"
                  >
                    {messages.remove}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty-state">{messages.savedAppsEmpty}</div>
      )}
    </section>
  );
}
