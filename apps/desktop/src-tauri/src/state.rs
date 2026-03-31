use std::collections::VecDeque;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use anyhow::{Context, Result};
use glare_mute_core::{
    APP_NAME, AppSettings, AppSnapshot, LOG_FILE_NAME, PlatformSummary, RECENT_EVENT_LIMIT,
    RuntimeDiagnostics, RuntimeEvent, RuntimeEventLevel, SETTINGS_FILE_NAME, ThemePreference,
    default_preset_catalog,
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

    pub fn toggle_suspend(&self) -> Result<AppSnapshot> {
        let new_state = {
            let mut diagnostics = self.diagnostics.lock().expect("diagnostics lock poisoned");
            diagnostics.suspended = !diagnostics.suspended;
            diagnostics.suspended
        };

        self.lens.set_suspended(new_state)?;

        self.record_event(
            RuntimeEventLevel::Info,
            "session".to_string(),
            if new_state {
                "lens output suspended".to_string()
            } else {
                "lens output resumed".to_string()
            },
        );

        self.snapshot()
    }

    pub fn refresh_window_candidates(&self) -> Result<AppSnapshot> {
        self.snapshot()
    }

    pub fn attach_window(
        &self,
        window_id: &str,
        preset: glare_mute_core::VisualPreset,
    ) -> Result<AppSnapshot> {
        let lens = self.lens.attach_window(window_id, preset)?;
        let target = lens
            .active_target
            .as_ref()
            .map(|entry| entry.title.as_str())
            .unwrap_or("selected window");
        self.record_event(
            RuntimeEventLevel::Info,
            "lens".to_string(),
            format!("applied {:?} to {}", preset, target),
        );

        self.snapshot()
    }

    pub fn detach_lens(&self) -> Result<AppSnapshot> {
        self.lens.detach()?;
        {
            let mut diagnostics = self.diagnostics.lock().expect("diagnostics lock poisoned");
            diagnostics.suspended = false;
        }
        self.record_event(
            RuntimeEventLevel::Info,
            "lens".to_string(),
            "turned off the current effect".to_string(),
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
