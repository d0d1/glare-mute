import { ChoiceField, type ChoiceOption } from "../../components/ChoiceField";
import type { AppLanguage, ThemePreference } from "../../lib/contracts";
import type { Messages } from "../../lib/i18n";

type BusyAction = "saveProfile" | "profiles" | "copy" | "logs" | "settings" | null;

export function SettingsPanel({
  busyAction,
  languageChoices,
  messages,
  onLanguageChange,
  onRelatedWindowScopeChange,
  onThemeChange,
  settings,
  themeChoices,
}: {
  busyAction: BusyAction;
  languageChoices: ChoiceOption[];
  messages: Messages;
  onLanguageChange: (language: AppLanguage) => void;
  onRelatedWindowScopeChange: (enabled: boolean) => void;
  onThemeChange: (theme: ThemePreference) => void;
  settings: {
    applyToRelatedWindows: boolean;
    language: AppLanguage;
    themePreference: ThemePreference;
  };
  themeChoices: ChoiceOption[];
}) {
  return (
    <details className="drawer-panel settings-panel">
      <summary>
        <span>{messages.settings}</span>
      </summary>
      <div className="drawer-body">
        <section className="drawer-section">
          <ChoiceField
            disabled={busyAction === "settings"}
            id="language-select"
            label={messages.language}
            onChange={(value) => onLanguageChange(value as AppLanguage)}
            options={languageChoices}
            value={settings.language}
          />
        </section>
        <section className="drawer-section">
          <ChoiceField
            disabled={busyAction === "settings"}
            id="theme-select"
            label={messages.theme}
            onChange={(value) => onThemeChange(value as ThemePreference)}
            options={themeChoices}
            value={settings.themePreference}
          />
        </section>
        <section className="drawer-section">
          <label className="toggle-switch" htmlFor="related-windows-toggle">
            <span className="toggle-switch-wrap">
              <input
                aria-checked={settings.applyToRelatedWindows}
                checked={settings.applyToRelatedWindows}
                className="toggle-switch-input"
                disabled={busyAction === "settings"}
                id="related-windows-toggle"
                onChange={(event) => onRelatedWindowScopeChange(event.target.checked)}
                role="switch"
                type="checkbox"
              />
              <span aria-hidden="true" className="toggle-switch-control" />
            </span>
            <div className="toggle-copy">
              <span className="field-label">{messages.relatedWindows}</span>
              <p className="body-copy">{messages.relatedWindowsDescription}</p>
            </div>
          </label>
        </section>
      </div>
    </details>
  );
}
