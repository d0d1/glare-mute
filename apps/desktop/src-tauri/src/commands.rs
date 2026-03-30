use glare_mute_core::{AppSnapshot, RuntimeEventLevel, ThemePreference};
use tauri::{AppHandle, Manager, State, Theme};
use tauri_plugin_opener::OpenerExt;

use crate::state::ManagedState;

#[tauri::command]
pub fn bootstrap_state(state: State<'_, ManagedState>) -> AppSnapshot {
    state.bootstrap_snapshot()
}

#[tauri::command]
pub fn set_theme_preference(
    app: AppHandle,
    state: State<'_, ManagedState>,
    theme: ThemePreference,
) -> Result<AppSnapshot, String> {
    apply_theme_preference(&app, theme)?;
    state
        .set_theme_preference(theme)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn toggle_suspend(state: State<'_, ManagedState>) -> AppSnapshot {
    state.toggle_suspend()
}

#[tauri::command]
pub fn open_logs_directory(app: AppHandle) -> Result<(), String> {
    let log_directory = app
        .path()
        .app_log_dir()
        .map_err(|error| error.to_string())?;

    app.opener()
        .open_path(log_directory.display().to_string(), None::<String>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn append_frontend_log(
    state: State<'_, ManagedState>,
    level: RuntimeEventLevel,
    source: String,
    message: String,
) {
    state.record_event(level, source, message);
}

#[tauri::command]
pub fn get_debug_report(state: State<'_, ManagedState>) -> Result<String, String> {
    state.debug_report().map_err(|error| error.to_string())
}

fn apply_theme_preference(app: &AppHandle, theme: ThemePreference) -> Result<(), String> {
    let native_theme = match theme {
        ThemePreference::System => None,
        ThemePreference::Light => Some(Theme::Light),
        ThemePreference::Dark => Some(Theme::Dark),
    };

    for window in app.webview_windows().values() {
        window
            .set_theme(native_theme)
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}
