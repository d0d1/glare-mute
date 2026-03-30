use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

use crate::state::ManagedState;

const MENU_OPEN: &str = "open";
const MENU_TOGGLE_SUSPEND: &str = "toggle-suspend";
const MENU_DETACH_LENS: &str = "detach-lens";
const MENU_OPEN_LOGS: &str = "open-logs";
const MENU_QUIT: &str = "quit";
const TRAY_ID: &str = "main-tray";

pub fn build_tray(app: &App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, MENU_OPEN, "Open GlareMute", true, None::<&str>)?;
    let suspend = MenuItem::with_id(
        app,
        MENU_TOGGLE_SUSPEND,
        "Toggle suspend",
        true,
        None::<&str>,
    )?;
    let detach = MenuItem::with_id(app, MENU_DETACH_LENS, "Detach lens", true, None::<&str>)?;
    let open_logs = MenuItem::with_id(
        app,
        MENU_OPEN_LOGS,
        "Open logs directory",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[&open, &suspend, &detach, &open_logs, &separator, &quit],
    )?;

    TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("GlareMute")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_menu_event(app, event.id.as_ref()))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = toggle_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

pub fn show_main_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_minimized().unwrap_or(false) {
            let _ = window.unminimize();
        }
        window.show()?;
        window.set_focus()?;
    }

    Ok(())
}

pub fn toggle_main_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            window.hide()?;
        } else {
            show_main_window(app)?;
        }
    }

    Ok(())
}

fn handle_menu_event(app: &AppHandle, event_id: &str) {
    match event_id {
        MENU_OPEN => {
            let _ = show_main_window(app);
        }
        MENU_TOGGLE_SUSPEND => {
            let state = app.state::<ManagedState>();
            match state.toggle_suspend() {
                Ok(snapshot) => {
                    state.record_event(
                        glare_mute_core::RuntimeEventLevel::Debug,
                        "tray".to_string(),
                        format!(
                            "tray toggled suspended state to {}",
                            snapshot.diagnostics.suspended
                        ),
                    );
                }
                Err(error) => {
                    state.record_event(
                        glare_mute_core::RuntimeEventLevel::Error,
                        "tray".to_string(),
                        format!("tray failed to toggle suspended state: {error}"),
                    );
                }
            }
        }
        MENU_DETACH_LENS => {
            let state = app.state::<ManagedState>();
            match state.detach_lens() {
                Ok(snapshot) => {
                    state.record_event(
                        glare_mute_core::RuntimeEventLevel::Debug,
                        "tray".to_string(),
                        format!(
                            "tray detached lens; active target now {:?}",
                            snapshot
                                .lens
                                .active_target
                                .as_ref()
                                .map(|entry| &entry.title)
                        ),
                    );
                }
                Err(error) => {
                    state.record_event(
                        glare_mute_core::RuntimeEventLevel::Error,
                        "tray".to_string(),
                        format!("tray failed to detach lens: {error}"),
                    );
                }
            }
        }
        MENU_OPEN_LOGS => {
            if let Ok(log_directory) = app.path().app_log_dir() {
                let _ = app
                    .opener()
                    .open_path(log_directory.display().to_string(), None::<String>);
            }
        }
        MENU_QUIT => {
            app.exit(0);
        }
        _ => {}
    }
}
