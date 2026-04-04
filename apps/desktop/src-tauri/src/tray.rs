use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Manager, image::Image};
use tauri_plugin_opener::OpenerExt;
use tracing::warn;

const MENU_OPEN: &str = "open";
const MENU_OPEN_LOGS: &str = "open-logs";
const MENU_QUIT: &str = "quit";
const TRAY_ID: &str = "main-tray";
const TRAY_ICON_PNG: &[u8] = include_bytes!("../icons/tray-icon.png");

pub fn build_tray(app: &App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, MENU_OPEN, "Open Glare mute", true, None::<&str>)?;
    let open_logs = MenuItem::with_id(
        app,
        MENU_OPEN_LOGS,
        "Open logs directory",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &open_logs, &separator, &quit])?;

    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("Glare mute")
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
        });

    match Image::from_bytes(TRAY_ICON_PNG) {
        Ok(icon) => {
            tray = tray.icon(icon);
        }
        Err(error) => {
            warn!(
                ?error,
                "failed to load dedicated tray icon; falling back to app icon"
            );
            if let Some(icon) = app.default_window_icon().cloned() {
                tray = tray.icon(icon);
            }
        }
    }

    tray.build(app)?;

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
