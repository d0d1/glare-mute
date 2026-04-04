mod commands;
mod lens;
mod logging;
mod state;
mod tray;

use tauri::{Builder, Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            let _ = tray::show_main_window(app);
        }))
        .setup(|app| {
            let logging_guard = logging::init_logging(app.handle()).map_err(setup_error)?;
            app.manage(logging_guard);

            let state = state::ManagedState::new(app.handle()).map_err(setup_error)?;
            state.record_event(
                glare_mute_core::RuntimeEventLevel::Info,
                "bootstrap".to_string(),
                "desktop shell initialized".to_string(),
            );
            app.manage(state);

            tray::build_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::append_frontend_log,
            commands::bootstrap_state,
            commands::get_debug_report,
            commands::open_logs_directory,
            commands::refresh_window_candidates,
            commands::remove_profile,
            commands::save_profile_from_window,
            commands::set_apply_to_related_windows,
            commands::set_language,
            commands::set_profile_enabled,
            commands::set_theme_preference
        ])
        .run(tauri::generate_context!())
        .expect("error while running Glare mute desktop application");
}

fn setup_error(error: anyhow::Error) -> tauri::Error {
    let boxed: Box<dyn std::error::Error> = Box::new(std::io::Error::other(error.to_string()));
    tauri::Error::Setup(boxed.into())
}
