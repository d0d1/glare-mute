use std::collections::VecDeque;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use anyhow::{Context, Result};
use glare_mute_core::{
    APP_NAME, AppLanguage, AppSettings, AppSnapshot, LOG_FILE_NAME, PlatformSummary, ProfileRule,
    RECENT_EVENT_LIMIT, RuntimeDiagnostics, RuntimeEvent, RuntimeEventLevel, SETTINGS_FILE_NAME,
    ThemePreference, VisualPreset, default_preset_catalog,
};
use tauri::{AppHandle, Manager};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

use crate::lens::LensController;

pub struct ManagedState {
    settings_store: Mutex<SettingsStore>,
    diagnostics: Mutex<DiagnosticsState>,
    lens: LensController,
    platform: PlatformSummary,
    app_version: String,
    settings_file: PathBuf,
    log_file: PathBuf,
    dev_mode: bool,
}

struct SettingsStore {
    current: AppSettings,
}

struct DiagnosticsState {
    // Suspend remains an internal runtime concept for startup/debug bookkeeping,
    // but the product UI no longer exposes Pause because users had no meaningful
    // distinction between Pause and Turn off in the current workflow.
    suspended: bool,
    recent_events: VecDeque<RuntimeEvent>,
}

impl ManagedState {
    pub fn new(app: &AppHandle) -> Result<Self> {
        let config_directory = app
            .path()
            .app_config_dir()
            .context("failed to resolve app config directory")?;
        let log_directory = app
            .path()
            .app_log_dir()
            .context("failed to resolve app log directory")?;

        fs::create_dir_all(&config_directory).context("failed to create app config directory")?;
        fs::create_dir_all(&log_directory).context("failed to create app log directory")?;

        let settings_file = config_directory.join(SETTINGS_FILE_NAME);
        let log_file = log_directory.join(LOG_FILE_NAME);
        let settings = load_settings(&settings_file)?;
        let webview_version = tauri::webview_version().ok();
        let lens = LensController::new(
            settings.suspend_on_startup,
            settings.apply_to_related_windows,
        )?;
        lens.set_profiles(settings.profiles.clone())?;

        Ok(Self {
            settings_store: Mutex::new(SettingsStore {
                current: settings.clone(),
            }),
            diagnostics: Mutex::new(DiagnosticsState {
                suspended: settings.suspend_on_startup,
                recent_events: VecDeque::new(),
            }),
            lens,
            platform: glare_mute_platform::probe_platform(webview_version),
            app_version: app.package_info().version.to_string(),
            settings_file,
            log_file,
            dev_mode: cfg!(debug_assertions),
        })
    }

    pub fn bootstrap_snapshot(&self) -> Result<AppSnapshot> {
        self.snapshot()
    }

    pub fn set_theme_preference(&self, theme: ThemePreference) -> Result<AppSnapshot> {
        let snapshot = {
            let mut store = self.settings_store.lock().expect("settings lock poisoned");
            store.current.theme_preference = theme;
            persist_settings(&self.settings_file, &store.current)?;
            store.current.clone()
        };

        self.record_event(
            RuntimeEventLevel::Info,
            "settings".to_string(),
            format!("theme preference updated to {:?}", theme),
        );

        self.snapshot_with_settings(snapshot)
    }

    pub fn set_language(&self, language: AppLanguage) -> Result<AppSnapshot> {
        let snapshot = {
            let mut store = self.settings_store.lock().expect("settings lock poisoned");
            store.current.language = language;
            persist_settings(&self.settings_file, &store.current)?;
            store.current.clone()
        };

        self.record_event(
            RuntimeEventLevel::Info,
            "settings".to_string(),
            format!("language updated to {:?}", language),
        );

        self.snapshot_with_settings(snapshot)
    }

    pub fn set_apply_to_related_windows(&self, enabled: bool) -> Result<AppSnapshot> {
        let snapshot = {
            let mut store = self.settings_store.lock().expect("settings lock poisoned");
            store.current.apply_to_related_windows = enabled;
            persist_settings(&self.settings_file, &store.current)?;
            store.current.clone()
        };

        self.lens.set_apply_to_related_windows(enabled)?;

        self.record_event(
            RuntimeEventLevel::Info,
            "settings".to_string(),
            if enabled {
                "related window coverage enabled".to_string()
            } else {
                "related window coverage disabled".to_string()
            },
        );

        self.snapshot_with_settings(snapshot)
    }

    pub fn refresh_window_candidates(&self) -> Result<AppSnapshot> {
        self.snapshot()
    }

    pub fn save_profile_from_window(
        &self,
        window_id: &str,
        preset: VisualPreset,
    ) -> Result<AppSnapshot> {
        let descriptor = self
            .lens
            .list_windows()?
            .into_iter()
            .find(|candidate| candidate.logical_target_id == window_id)
            .ok_or_else(|| anyhow::anyhow!("The selected window is no longer available."))?;
        let executable_path = descriptor.executable_path.clone().ok_or_else(|| {
            anyhow::anyhow!("The selected window does not expose an executable path.")
        })?;
        let label = profile_label_for_window(&descriptor);
        let title_pattern = profile_title_pattern_for_window(&descriptor);

        let settings = {
            let mut store = self.settings_store.lock().expect("settings lock poisoned");
            upsert_profile(
                &mut store.current.profiles,
                ProfileRule {
                    id: String::new(),
                    enabled: true,
                    label: label.clone(),
                    executable_path,
                    preset,
                    title_pattern,
                    window_class: descriptor.window_class.clone(),
                    notes: None,
                },
            );
            persist_settings(&self.settings_file, &store.current)?;
            store.current.clone()
        };

        self.lens.set_profiles(settings.profiles.clone())?;
        self.record_event(
            RuntimeEventLevel::Info,
            "profiles".to_string(),
            format!("saved {:?} for {}", preset, label),
        );

        self.snapshot_with_settings(settings)
    }

    pub fn remove_profile(&self, profile_id: &str) -> Result<AppSnapshot> {
        let (removed_label, next_profiles) = {
            let mut store = self.settings_store.lock().expect("settings lock poisoned");
            let Some(index) = store
                .current
                .profiles
                .iter()
                .position(|profile| profile.id == profile_id)
            else {
                anyhow::bail!("The selected saved app no longer exists.");
            };

            let removed = store.current.profiles.remove(index);
            persist_settings(&self.settings_file, &store.current)?;
            (removed.label, store.current.profiles.clone())
        };
        self.lens.set_profiles(next_profiles)?;
        self.record_event(
            RuntimeEventLevel::Info,
            "profiles".to_string(),
            format!("removed saved app {}", removed_label),
        );

        self.snapshot()
    }

    pub fn set_profile_enabled(&self, profile_id: &str, enabled: bool) -> Result<AppSnapshot> {
        let (updated_label, next_profiles) = {
            let mut store = self.settings_store.lock().expect("settings lock poisoned");
            let Some(profile) = store
                .current
                .profiles
                .iter_mut()
                .find(|profile| profile.id == profile_id)
            else {
                anyhow::bail!("The selected saved app no longer exists.");
            };

            profile.enabled = enabled;
            let label = profile.label.clone();
            persist_settings(&self.settings_file, &store.current)?;
            (label, store.current.profiles.clone())
        };
        self.lens.set_profiles(next_profiles)?;

        self.record_event(
            RuntimeEventLevel::Info,
            "profiles".to_string(),
            if enabled {
                format!("enabled saved app {}", updated_label)
            } else {
                format!("disabled saved app {}", updated_label)
            },
        );

        self.snapshot()
    }

    pub fn record_event(&self, level: RuntimeEventLevel, source: String, message: String) {
        match level {
            RuntimeEventLevel::Trace => tracing::trace!(%source, %message),
            RuntimeEventLevel::Debug => tracing::debug!(%source, %message),
            RuntimeEventLevel::Info => tracing::info!(%source, %message),
            RuntimeEventLevel::Warn => tracing::warn!(%source, %message),
            RuntimeEventLevel::Error => tracing::error!(%source, %message),
        }

        let event = RuntimeEvent {
            timestamp: OffsetDateTime::now_utc()
                .format(&Rfc3339)
                .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string()),
            level,
            source,
            message,
        };

        let mut diagnostics = self.diagnostics.lock().expect("diagnostics lock poisoned");
        diagnostics.recent_events.push_front(event);
        while diagnostics.recent_events.len() > RECENT_EVENT_LIMIT {
            diagnostics.recent_events.pop_back();
        }
    }

    pub fn debug_report(&self) -> Result<String> {
        serde_json::to_string_pretty(&self.snapshot()?).context("failed to serialize debug report")
    }

    fn snapshot(&self) -> Result<AppSnapshot> {
        let settings = self
            .settings_store
            .lock()
            .expect("settings lock poisoned")
            .current
            .clone();

        self.snapshot_with_settings(settings)
    }

    fn snapshot_with_settings(&self, settings: AppSettings) -> Result<AppSnapshot> {
        let diagnostics = self.diagnostics.lock().expect("diagnostics lock poisoned");
        let lens = self.lens.snapshot()?;
        let window_candidates = self.lens.list_windows()?;

        Ok(AppSnapshot {
            app_name: APP_NAME.to_string(),
            app_version: self.app_version.clone(),
            dev_mode: self.dev_mode,
            settings,
            presets: default_preset_catalog(),
            diagnostics: RuntimeDiagnostics {
                suspended: diagnostics.suspended,
                settings_file: self.settings_file.display().to_string(),
                log_file: self.log_file.display().to_string(),
                recent_events: diagnostics.recent_events.iter().cloned().collect(),
            },
            platform: self.platform.clone(),
            lens,
            window_candidates,
        })
    }
}

fn load_settings(path: &PathBuf) -> Result<AppSettings> {
    if !path.exists() {
        let settings = AppSettings::default();
        persist_settings(path, &settings)?;
        return Ok(settings);
    }

    let payload = fs::read(path).with_context(|| format!("failed to read {}", path.display()))?;
    let settings: AppSettings = serde_json::from_slice(&payload)
        .with_context(|| format!("failed to parse {}", path.display()))?;
    Ok(settings)
}

fn persist_settings(path: &PathBuf, settings: &AppSettings) -> Result<()> {
    let payload =
        serde_json::to_vec_pretty(settings).context("failed to encode settings as json")?;
    fs::write(path, payload).with_context(|| format!("failed to write {}", path.display()))
}

fn upsert_profile(profiles: &mut Vec<ProfileRule>, mut next_profile: ProfileRule) {
    if let Some(existing) = profiles.iter_mut().find(|profile| {
        profile
            .executable_path
            .eq_ignore_ascii_case(&next_profile.executable_path)
            && profile.window_class == next_profile.window_class
            && profile.title_pattern == next_profile.title_pattern
    }) {
        existing.enabled = true;
        existing.label = next_profile.label;
        existing.preset = next_profile.preset;
        existing.notes = next_profile.notes;
        return;
    }

    next_profile.id = generate_profile_id(&next_profile);
    profiles.push(next_profile);
}

fn generate_profile_id(profile: &ProfileRule) -> String {
    let slug = executable_name(&profile.executable_path)
        .unwrap_or_else(|| "app".to_string())
        .to_ascii_lowercase()
        .replace(|character: char| !character.is_ascii_alphanumeric(), "-");
    let timestamp = OffsetDateTime::now_utc().unix_timestamp_nanos();
    format!("profile-{slug}-{timestamp}")
}

fn profile_label_for_window(descriptor: &glare_mute_core::WindowDescriptor) -> String {
    if is_ambiguous_host_descriptor(descriptor) {
        return descriptor.title.clone();
    }

    descriptor
        .executable_path
        .as_deref()
        .and_then(executable_name)
        .unwrap_or_else(|| descriptor.title.clone())
}

fn profile_title_pattern_for_window(
    descriptor: &glare_mute_core::WindowDescriptor,
) -> Option<String> {
    if is_ambiguous_host_descriptor(descriptor) {
        return Some(normalize_title(&descriptor.title));
    }

    None
}

fn normalize_title(title: &str) -> String {
    title.trim().to_lowercase()
}

fn is_ambiguous_host_descriptor(descriptor: &glare_mute_core::WindowDescriptor) -> bool {
    descriptor
        .window_class
        .as_deref()
        .map(|class_name| class_name.to_ascii_lowercase().contains("applicationframe"))
        .unwrap_or(false)
        || descriptor
            .executable_path
            .as_deref()
            .and_then(executable_name)
            .map(|name| is_host_process_name(&name))
            .unwrap_or(false)
}

fn is_host_process_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "applicationframehost"
            | "applicationframehost.exe"
            | "systemsettings"
            | "systemsettings.exe"
    )
}

fn executable_name(path: &str) -> Option<String> {
    Path::new(path)
        .file_stem()
        .map(|name| name.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use glare_mute_core::{WindowAttachmentState, WindowBounds, WindowDescriptor};

    fn descriptor(title: &str, executable_path: &str, window_class: &str) -> WindowDescriptor {
        WindowDescriptor {
            window_id: "0x1".to_string(),
            logical_target_id: "logical:1".to_string(),
            secondary_label: None,
            title: title.to_string(),
            executable_path: Some(executable_path.to_string()),
            process_id: 1234,
            window_class: Some(window_class.to_string()),
            bounds: WindowBounds {
                left: 0,
                top: 0,
                width: 100,
                height: 100,
            },
            attachment_state: WindowAttachmentState::Available,
            is_foreground: false,
        }
    }

    #[test]
    fn uses_title_pattern_for_ambiguous_hosted_windows() {
        let candidate = descriptor(
            "Clock",
            "C:\\Windows\\System32\\ApplicationFrameHost.exe",
            "ApplicationFrameWindow",
        );

        assert_eq!(
            profile_title_pattern_for_window(&candidate).as_deref(),
            Some("clock")
        );
        assert_eq!(profile_label_for_window(&candidate), "Clock");
    }

    #[test]
    fn keeps_plain_executable_profiles_for_normal_windows() {
        let candidate = descriptor("Notepad", "C:\\Windows\\notepad.exe", "Notepad");

        assert_eq!(profile_title_pattern_for_window(&candidate), None);
        assert_eq!(profile_label_for_window(&candidate), "notepad");
    }
}
