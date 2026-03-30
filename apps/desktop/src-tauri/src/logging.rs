use std::fs;

use anyhow::{Context, Result};
use glare_mute_core::{APP_NAME, LOG_FILE_NAME};
use tauri::{AppHandle, Manager};
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::EnvFilter;

pub struct LoggingGuard {
    _worker_guard: WorkerGuard,
}

pub fn init_logging(app: &AppHandle) -> Result<LoggingGuard> {
    let log_directory = app
        .path()
        .app_log_dir()
        .context("failed to resolve app log directory")?;
    fs::create_dir_all(&log_directory).context("failed to create app log directory")?;

    let file_appender = tracing_appender::rolling::never(log_directory, LOG_FILE_NAME);
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,tao=warn,wry=warn")),
        )
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(false)
        .finish();

    tracing::subscriber::set_global_default(subscriber)
        .context("failed to install global tracing subscriber")?;
    tracing::info!(app = APP_NAME, "logging initialized");

    Ok(LoggingGuard {
        _worker_guard: guard,
    })
}
