use serde::{Deserialize, Serialize};

pub const APP_NAME: &str = "GlareMute";
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
    GreyscaleInvert,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EffectFamily {
    Tint,
    Transform,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum VisualPreset {
    Darken,
    WarmDim,
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
    pub theme_preference: ThemePreference,
    pub panic_hotkey: String,
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
    Attached,
    Suspended,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LensSnapshot {
    pub status: LensStatus,
    pub active_preset: Option<VisualPreset>,
    pub active_target: Option<WindowDescriptor>,
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

impl Default for VisualPreset {
    fn default() -> Self {
        Self::Darken
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme_preference: ThemePreference::System,
            panic_hotkey: "Ctrl+Shift+Pause".to_string(),
            suspend_on_startup: false,
            profiles: Vec::new(),
        }
    }
}

pub fn default_preset_catalog() -> Vec<PresetDefinition> {
    vec![
        PresetDefinition {
            id: VisualPreset::Darken,
            label: "Darken".to_string(),
            family: EffectFamily::Tint,
            summary: "A zero-lag neutral dim layer that reduces raw glare.".to_string(),
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

        assert_eq!(settings.theme_preference, ThemePreference::System);
        assert_eq!(settings.panic_hotkey, "Ctrl+Shift+Pause");
        assert!(settings.profiles.is_empty());
    }

    #[test]
    fn preset_catalog_is_stable() {
        let presets = default_preset_catalog();

        assert_eq!(presets.len(), 3);
        assert_eq!(presets[0].id, VisualPreset::Darken);
        assert_eq!(presets[2].family, EffectFamily::Transform);
    }

    #[test]
    fn lens_status_serializes_as_camel_case() {
        let payload = serde_json::to_string(&LensStatus::Detached).expect("serialize lens status");
        assert_eq!(payload, "\"detached\"");
    }
}
