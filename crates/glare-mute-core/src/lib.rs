use serde::{Deserialize, Deserializer, Serialize};

pub const APP_NAME: &str = "Glare mute";
pub const SETTINGS_FILE_NAME: &str = "settings.json";
pub const LOG_FILE_NAME: &str = "glare-mute.log";
pub const RECENT_EVENT_LIMIT: usize = 200;

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ThemePreference {
    #[default]
    System,
    Light,
    Dark,
    Invert,
    GreyscaleInvert,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
pub enum AppLanguage {
    #[default]
    #[serde(rename = "system")]
    System,
    #[serde(rename = "en")]
    En,
    #[serde(rename = "pt-BR")]
    PtBr,
    #[serde(rename = "es")]
    Es,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EffectFamily {
    Tint,
    Transform,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum VisualPreset {
    WarmDim,
    #[default]
    Invert,
    GreyscaleInvert,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CapabilityStatus {
    Available,
    Experimental,
    Planned,
    Unsupported,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RuntimeEventLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetDefinition {
    pub id: VisualPreset,
    pub label: String,
    pub family: EffectFamily,
    pub summary: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityDescriptor {
    pub id: String,
    pub label: String,
    pub status: CapabilityStatus,
    pub summary: String,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ProfileRule {
    pub executable_path: String,
    pub preset: VisualPreset,
    pub title_pattern: Option<String>,
    pub window_class: Option<String>,
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_app_language")]
    pub language: AppLanguage,
    pub theme_preference: ThemePreference,
    #[serde(default = "default_apply_to_related_windows")]
    pub apply_to_related_windows: bool,
    pub suspend_on_startup: bool,
    pub profiles: Vec<ProfileRule>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeEvent {
    pub timestamp: String,
    pub level: RuntimeEventLevel,
    pub source: String,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDiagnostics {
    pub suspended: bool,
    pub settings_file: String,
    pub log_file: String,
    pub recent_events: Vec<RuntimeEvent>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformSummary {
    pub os: String,
    pub target: String,
    pub backend_id: String,
    pub backend_label: String,
    pub webview_version: Option<String>,
    pub capabilities: Vec<CapabilityDescriptor>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowBounds {
    pub left: i32,
    pub top: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WindowAttachmentState {
    Available,
    Minimized,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowDescriptor {
    pub window_id: String,
    #[serde(default)]
    pub logical_target_id: String,
    #[serde(default)]
    pub secondary_label: Option<String>,
    pub title: String,
    pub executable_path: Option<String>,
    pub process_id: u32,
    pub window_class: Option<String>,
    pub bounds: WindowBounds,
    pub attachment_state: WindowAttachmentState,
    pub is_foreground: bool,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum LensStatus {
    Detached,
    Pending,
    Attached,
    Suspended,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LensSnapshot {
    pub status: LensStatus,
    pub active_preset: Option<VisualPreset>,
    pub active_target: Option<WindowDescriptor>,
    pub covered_targets: Vec<WindowDescriptor>,
    pub summary: String,
    pub backend_label: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    pub app_name: String,
    pub app_version: String,
    pub dev_mode: bool,
    pub settings: AppSettings,
    pub presets: Vec<PresetDefinition>,
    pub diagnostics: RuntimeDiagnostics,
    pub platform: PlatformSummary,
    pub lens: LensSnapshot,
    pub window_candidates: Vec<WindowDescriptor>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            language: default_app_language(),
            theme_preference: ThemePreference::System,
            apply_to_related_windows: default_apply_to_related_windows(),
            suspend_on_startup: false,
            profiles: Vec::new(),
        }
    }
}

impl<'de> Deserialize<'de> for VisualPreset {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = String::deserialize(deserializer)?;
        match raw.as_str() {
            "warmDim" => Ok(Self::WarmDim),
            "invert" => Ok(Self::Invert),
            "greyscaleInvert" => Ok(Self::GreyscaleInvert),
            // Legacy faux-dark values are intentionally migrated to the stable
            // greyscale path instead of reviving the abandoned dark-mode claim.
            "dark" | "darken" => Ok(Self::GreyscaleInvert),
            other => Err(serde::de::Error::unknown_variant(
                other,
                &["warmDim", "invert", "greyscaleInvert"],
            )),
        }
    }
}

fn default_apply_to_related_windows() -> bool {
    true
}

fn default_app_language() -> AppLanguage {
    AppLanguage::System
}

pub fn default_preset_catalog() -> Vec<PresetDefinition> {
    vec![
        PresetDefinition {
            id: VisualPreset::Invert,
            label: "Invert".to_string(),
            family: EffectFamily::Transform,
            summary: "A full-color invert for apps where non-grey color cues still matter."
                .to_string(),
        },
        PresetDefinition {
            id: VisualPreset::WarmDim,
            label: "Warm Dim".to_string(),
            family: EffectFamily::Tint,
            summary: "A warmer amber tint that softens white-heavy legacy interfaces.".to_string(),
        },
        PresetDefinition {
            id: VisualPreset::GreyscaleInvert,
            label: "Greyscale Invert".to_string(),
            family: EffectFamily::Transform,
            summary: "A transform-mode preset aimed at harsh white screens that ignore dark mode."
                .to_string(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_settings_favor_system_theme() {
        let settings = AppSettings::default();

        assert_eq!(settings.language, AppLanguage::System);
        assert_eq!(settings.theme_preference, ThemePreference::System);
        assert!(settings.apply_to_related_windows);
        assert!(settings.profiles.is_empty());
    }

    #[test]
    fn legacy_settings_missing_related_window_scope_default_to_enabled() {
        let settings: AppSettings = serde_json::from_str(
            r#"{
                "themePreference": "system",
                "suspendOnStartup": false,
                "profiles": []
            }"#,
        )
        .expect("deserialize legacy settings");

        assert!(settings.apply_to_related_windows);
    }

    #[test]
    fn legacy_settings_missing_language_default_to_system() {
        let settings: AppSettings = serde_json::from_str(
            r#"{
                "themePreference": "system",
                "applyToRelatedWindows": true,
                "suspendOnStartup": false,
                "profiles": []
            }"#,
        )
        .expect("deserialize legacy settings");

        assert_eq!(settings.language, AppLanguage::System);
    }

    #[test]
    fn legacy_dark_values_migrate_to_greyscale_invert() {
        let dark: VisualPreset =
            serde_json::from_str("\"dark\"").expect("deserialize legacy dark preset");
        let darken: VisualPreset =
            serde_json::from_str("\"darken\"").expect("deserialize legacy darken preset");

        assert_eq!(dark, VisualPreset::GreyscaleInvert);
        assert_eq!(darken, VisualPreset::GreyscaleInvert);
    }

    #[test]
    fn preset_catalog_is_stable() {
        let presets = default_preset_catalog();

        assert_eq!(presets.len(), 3);
        assert_eq!(presets[0].id, VisualPreset::Invert);
        assert_eq!(presets[2].family, EffectFamily::Transform);
    }

    #[test]
    fn lens_status_serializes_as_camel_case() {
        let payload = serde_json::to_string(&LensStatus::Detached).expect("serialize lens status");
        assert_eq!(payload, "\"detached\"");
    }
}
