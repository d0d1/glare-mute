mod effects;
mod overlay;
mod windowing;

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use anyhow::{Context, Result, anyhow, bail};
use glare_mute_core::{
    LensSnapshot, LensStatus, VisualPreset, WindowAttachmentState, WindowDescriptor,
};
use windows::Win32::UI::Magnification::{
    MW_FILTERMODE_EXCLUDE, MagInitialize, MagSetWindowFilterList, MagUninitialize,
};

use self::effects::preset_label;
use self::overlay::OverlaySurface;
use self::windowing::{
    RawWindowCandidate, ensure_bool, enumerate_raw_windows, presentation_target, pump_messages,
    register_host_window_class,
};

const THREAD_TICK_INTERVAL: Duration = Duration::from_millis(16);
const TARGET_SCAN_INTERVAL: Duration = Duration::from_millis(250);

pub(super) struct LensControllerImpl {
    command_tx: Sender<ControllerCommand>,
    shared_snapshot: Arc<Mutex<LensSnapshot>>,
    worker: Option<JoinHandle<()>>,
}

impl LensControllerImpl {
    pub(super) fn new(initially_suspended: bool, apply_to_related_windows: bool) -> Result<Self> {
        let shared_snapshot = Arc::new(Mutex::new(LensSnapshot {
            status: if initially_suspended {
                LensStatus::Suspended
            } else {
                LensStatus::Detached
            },
            active_preset: None,
            active_target: None,
            covered_targets: Vec::new(),
            summary: if initially_suspended {
                "The current effect is paused.".to_string()
            } else {
                "No effect is active.".to_string()
            },
            backend_label: "Windows Magnification backend".to_string(),
        }));
        let (command_tx, command_rx) = mpsc::channel();
        let worker_snapshot = Arc::clone(&shared_snapshot);

        let worker = thread::Builder::new()
            .name("glaremute-lens".to_string())
            .spawn(move || {
                if let Err(error) =
                    lens_thread_main(command_rx, worker_snapshot, apply_to_related_windows)
                {
                    tracing::error!(?error, "lens worker failed");
                }
            })
            .context("failed to spawn lens worker thread")?;

        Ok(Self {
            command_tx,
            shared_snapshot,
            worker: Some(worker),
        })
    }

    pub(super) fn attach_window(
        &self,
        window_id: &str,
        preset: VisualPreset,
    ) -> Result<LensSnapshot> {
        if !matches!(preset, VisualPreset::GreyscaleInvert | VisualPreset::Invert) {
            bail!("This effect is not implemented in the native Windows path right now.")
        }

        let descriptor = enumerate_logical_targets()?
            .into_iter()
            .map(|candidate| candidate.descriptor)
            .find(|candidate| candidate.logical_target_id == window_id)
            .ok_or_else(|| anyhow!("The selected window is no longer available."))?;
        let (response_tx, response_rx) = mpsc::channel();

        self.command_tx
            .send(ControllerCommand::Attach {
                descriptor,
                preset,
                response_tx,
            })
            .context("failed to send attach command to lens worker")?;
        response_rx
            .recv()
            .context("failed to receive attach confirmation from lens worker")??;

        self.snapshot()
    }

    pub(super) fn detach(&self) -> Result<LensSnapshot> {
        let (response_tx, response_rx) = mpsc::channel();
        self.command_tx
            .send(ControllerCommand::Detach { response_tx })
            .context("failed to send detach command to lens worker")?;
        response_rx
            .recv()
            .context("failed to receive detach confirmation from lens worker")??;

        self.snapshot()
    }

    pub(super) fn list_windows(&self) -> Result<Vec<WindowDescriptor>> {
        Ok(enumerate_logical_targets()?
            .into_iter()
            .map(|candidate| candidate.descriptor)
            .collect())
    }

    pub(super) fn set_apply_to_related_windows(&self, enabled: bool) -> Result<LensSnapshot> {
        let (response_tx, response_rx) = mpsc::channel();
        self.command_tx
            .send(ControllerCommand::SetApplyToRelatedWindows {
                enabled,
                response_tx,
            })
            .context("failed to send related-window command to lens worker")?;
        response_rx
            .recv()
            .context("failed to receive related-window confirmation from lens worker")??;

        self.snapshot()
    }

    pub(super) fn set_suspended(&self, suspended: bool) -> Result<LensSnapshot> {
        let (response_tx, response_rx) = mpsc::channel();
        self.command_tx
            .send(ControllerCommand::SetSuspended {
                suspended,
                response_tx,
            })
            .context("failed to send suspend command to lens worker")?;
        response_rx
            .recv()
            .context("failed to receive suspend confirmation from lens worker")??;

        self.snapshot()
    }

    pub(super) fn snapshot(&self) -> Result<LensSnapshot> {
        Ok(self
            .shared_snapshot
            .lock()
            .expect("lens snapshot lock poisoned")
            .clone())
    }
}

impl Drop for LensControllerImpl {
    fn drop(&mut self) {
        let _ = self.command_tx.send(ControllerCommand::Shutdown);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

enum ControllerCommand {
    Attach {
        descriptor: WindowDescriptor,
        preset: VisualPreset,
        response_tx: Sender<Result<()>>,
    },
    Detach {
        response_tx: Sender<Result<()>>,
    },
    SetApplyToRelatedWindows {
        enabled: bool,
        response_tx: Sender<Result<()>>,
    },
    SetSuspended {
        suspended: bool,
        response_tx: Sender<Result<()>>,
    },
    Shutdown,
}

#[derive(Clone)]
struct LogicalWindowCandidate {
    descriptor: WindowDescriptor,
    raw_targets: Vec<RawWindowCandidate>,
    related_group_key: String,
    allows_related_window_expansion: bool,
}

struct AttachmentSession {
    active_logical_target_id: String,
    preset: VisualPreset,
}

struct WorkerState {
    shared_snapshot: Arc<Mutex<LensSnapshot>>,
    session: Option<AttachmentSession>,
    covered_targets: Vec<WindowDescriptor>,
    surfaces: Vec<OverlaySurface>,
    suspended: bool,
    apply_to_related_windows: bool,
    last_target_scan: Instant,
}

fn lens_thread_main(
    command_rx: Receiver<ControllerCommand>,
    shared_snapshot: Arc<Mutex<LensSnapshot>>,
    apply_to_related_windows: bool,
) -> Result<()> {
    unsafe {
        ensure_bool(MagInitialize(), "failed to initialize Magnification API")?;
    }

    let mut runtime = match WorkerState::create(shared_snapshot, apply_to_related_windows) {
        Ok(runtime) => runtime,
        Err(error) => {
            unsafe {
                let _ = MagUninitialize();
            }
            return Err(error);
        }
    };

    let mut should_exit = false;
    while !should_exit {
        while pump_messages()? {}

        match command_rx.recv_timeout(THREAD_TICK_INTERVAL) {
            Ok(ControllerCommand::Attach {
                descriptor,
                preset,
                response_tx,
            }) => {
                let result = runtime.attach(descriptor, preset);
                let _ = response_tx.send(result);
            }
            Ok(ControllerCommand::Detach { response_tx }) => {
                let result = runtime.detach();
                let _ = response_tx.send(result);
            }
            Ok(ControllerCommand::SetApplyToRelatedWindows {
                enabled,
                response_tx,
            }) => {
                let result = runtime.set_apply_to_related_windows(enabled);
                let _ = response_tx.send(result);
            }
            Ok(ControllerCommand::SetSuspended {
                suspended,
                response_tx,
            }) => {
                let result = runtime.set_suspended(suspended);
                let _ = response_tx.send(result);
            }
            Ok(ControllerCommand::Shutdown) => should_exit = true,
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => should_exit = true,
        }

        runtime.tick();
    }

    let cleanup = runtime.cleanup();
    unsafe {
        let _ = MagUninitialize();
    }
    cleanup
}

impl WorkerState {
    fn create(
        shared_snapshot: Arc<Mutex<LensSnapshot>>,
        apply_to_related_windows: bool,
    ) -> Result<Self> {
        register_host_window_class()?;

        Ok(Self {
            shared_snapshot,
            session: None,
            covered_targets: Vec::new(),
            surfaces: Vec::new(),
            suspended: false,
            apply_to_related_windows,
            last_target_scan: Instant::now() - TARGET_SCAN_INTERVAL,
        })
    }

    fn attach(&mut self, descriptor: WindowDescriptor, preset: VisualPreset) -> Result<()> {
        tracing::info!(
            logical_target_id = %descriptor.logical_target_id,
            window_id = %descriptor.window_id,
            title = %descriptor.title,
            preset = ?preset,
            process_id = descriptor.process_id,
            apply_to_related_windows = self.apply_to_related_windows,
            "attaching magnifier backend"
        );

        self.session = Some(AttachmentSession {
            active_logical_target_id: descriptor.logical_target_id.clone(),
            preset,
        });
        self.last_target_scan = Instant::now() - TARGET_SCAN_INTERVAL;
        self.sync_targets(true)?;

        if self.session.is_none() {
            bail!("The selected window is no longer available.");
        }

        self.tick();
        Ok(())
    }

    fn detach(&mut self) -> Result<()> {
        self.suspended = false;
        self.clear_session()?;
        self.update_shared_snapshot();
        tracing::info!("detached magnifier backend");
        Ok(())
    }

    fn set_apply_to_related_windows(&mut self, enabled: bool) -> Result<()> {
        if self.apply_to_related_windows == enabled {
            self.update_shared_snapshot();
            return Ok(());
        }

        self.apply_to_related_windows = enabled;
        self.last_target_scan = Instant::now() - TARGET_SCAN_INTERVAL;
        self.sync_targets(true)?;
        self.update_shared_snapshot();
        tracing::info!(enabled, "updated related window coverage");
        Ok(())
    }

    fn set_suspended(&mut self, suspended: bool) -> Result<()> {
        self.suspended = suspended;
        if suspended {
            self.hide_all_surfaces();
        } else {
            self.last_target_scan = Instant::now() - TARGET_SCAN_INTERVAL;
            self.sync_targets(true)?;
        }

        self.update_shared_snapshot();
        tracing::info!(suspended, "updated lens suspended state");
        Ok(())
    }

    fn tick(&mut self) {
        if let Err(error) = self.sync_targets(false) {
            tracing::warn!(?error, "failed to refresh related window coverage");
            let _ = self.clear_session();
            self.update_shared_snapshot();
            return;
        }

        if self.suspended {
            self.hide_all_surfaces();
            return;
        }

        for surface in &mut self.surfaces {
            match presentation_target(surface.target_hwnd, surface.host_hwnd) {
                Ok(Some(target)) => {
                    if let Err(error) = surface.present(target) {
                        tracing::warn!(?error, "failed to update magnifier overlay");
                    }
                }
                Ok(None) => surface.hide(),
                Err(error) => {
                    tracing::warn!(?error, "target window became unavailable");
                    surface.hide();
                }
            }
        }
    }

    fn cleanup(&mut self) -> Result<()> {
        self.clear_session()
    }

    fn sync_targets(&mut self, force: bool) -> Result<()> {
        if !force && self.last_target_scan.elapsed() < TARGET_SCAN_INTERVAL {
            return Ok(());
        }
        self.last_target_scan = Instant::now();

        let Some(session) = self.session.as_ref() else {
            return Ok(());
        };

        let preset = session.preset;
        let logical_targets = enumerate_logical_targets()?;
        let Some(active_target) = logical_targets
            .iter()
            .find(|candidate| {
                candidate.descriptor.logical_target_id == session.active_logical_target_id
            })
            .cloned()
        else {
            tracing::info!(
                logical_target_id = %session.active_logical_target_id,
                "no logical targets remain for the current session"
            );
            self.clear_session()?;
            self.update_shared_snapshot();
            return Ok(());
        };

        let covered_targets = if self.apply_to_related_windows && active_target.allows_related_window_expansion
        {
            logical_targets
                .into_iter()
                .filter(|candidate| candidate.related_group_key == active_target.related_group_key)
                .collect::<Vec<_>>()
        } else {
            vec![active_target.clone()]
        };

        self.covered_targets = covered_targets
            .iter()
            .map(|candidate| candidate.descriptor.clone())
            .collect();
        self.reconcile_surfaces(&covered_targets, preset)?;
        self.update_shared_snapshot();
        Ok(())
    }

    fn reconcile_surfaces(
        &mut self,
        covered_targets: &[LogicalWindowCandidate],
        preset: VisualPreset,
    ) -> Result<()> {
        let desired_targets = covered_targets
            .iter()
            .flat_map(|candidate| candidate.raw_targets.iter())
            .filter(|candidate| {
                candidate.attachment_state == WindowAttachmentState::Available && !candidate.is_cloaked
            })
            .cloned()
            .collect::<Vec<_>>();

        let desired_ids = desired_targets
            .iter()
            .map(|candidate| candidate.window_id.clone())
            .collect::<HashSet<_>>();

        let mut retained_surfaces = Vec::with_capacity(self.surfaces.len());
        for surface in self.surfaces.drain(..) {
            if desired_ids.contains(&surface.target_window_id) {
                retained_surfaces.push(surface);
            } else if let Err(error) = surface.destroy() {
                tracing::warn!(?error, "failed to destroy retired magnifier surface");
            }
        }
        self.surfaces = retained_surfaces;

        for surface in &mut self.surfaces {
            surface.set_effect(preset)?;
        }

        for descriptor in desired_targets {
            if self
                .surfaces
                .iter()
                .any(|surface| surface.target_window_id == descriptor.window_id)
            {
                continue;
            }

            self.surfaces
                .push(OverlaySurface::create(&descriptor.window_id, preset)?);
        }

        self.refresh_filter_lists()?;
        Ok(())
    }

    fn refresh_filter_lists(&mut self) -> Result<()> {
        if self.surfaces.is_empty() {
            return Ok(());
        }

        let host_windows = self
            .surfaces
            .iter()
            .map(|entry| entry.host_hwnd)
            .collect::<Vec<_>>();
        for surface in &mut self.surfaces {
            let mut filter_windows = host_windows.clone();
            unsafe {
                ensure_bool(
                    MagSetWindowFilterList(
                        surface.magnifier_hwnd,
                        MW_FILTERMODE_EXCLUDE,
                        filter_windows.len() as i32,
                        filter_windows.as_mut_ptr(),
                    ),
                    "failed to exclude overlay windows from magnification",
                )?;
            }
        }

        Ok(())
    }

    fn clear_session(&mut self) -> Result<()> {
        self.covered_targets.clear();
        self.session = None;

        for surface in self.surfaces.drain(..) {
            surface.destroy()?;
        }

        Ok(())
    }

    fn hide_all_surfaces(&self) {
        for surface in &self.surfaces {
            surface.hide();
        }
    }

    fn active_target(&self) -> Option<WindowDescriptor> {
        let session = self.session.as_ref()?;
        self.covered_targets
            .iter()
            .find(|candidate| candidate.logical_target_id == session.active_logical_target_id)
            .cloned()
            .or_else(|| self.covered_targets.first().cloned())
    }

    fn active_preset(&self) -> Option<VisualPreset> {
        self.session.as_ref().map(|session| session.preset)
    }

    fn status(&self) -> LensStatus {
        if self.session.is_none() {
            return if self.suspended {
                LensStatus::Suspended
            } else {
                LensStatus::Detached
            };
        }

        if self.suspended {
            return LensStatus::Suspended;
        }

        if self
            .covered_targets
            .iter()
            .any(|candidate| candidate.attachment_state == WindowAttachmentState::Available)
        {
            LensStatus::Attached
        } else {
            LensStatus::Pending
        }
    }

    fn update_shared_snapshot(&self) {
        let status = self.status();
        let active_target = self.active_target();
        let active_preset = self.active_preset();
        let visible_count = self
            .covered_targets
            .iter()
            .filter(|candidate| candidate.attachment_state == WindowAttachmentState::Available)
            .count();
        let covered_count = self.covered_targets.len();
        let summary = match status {
            LensStatus::Detached => "No effect is active.".to_string(),
            LensStatus::Pending => {
                if covered_count > 1 {
                    format!(
                        "{} will appear when the selected app is back on screen.",
                        preset_label(active_preset)
                    )
                } else {
                    let target = active_target
                        .as_ref()
                        .map(|entry| entry.title.as_str())
                        .unwrap_or("the selected window");
                    format!(
                        "{} will appear when {target} is back on screen.",
                        preset_label(active_preset)
                    )
                }
            }
            LensStatus::Attached => {
                if covered_count > 1 {
                    format!(
                        "{} is active on {} windows from the same app.",
                        preset_label(active_preset),
                        visible_count.max(1)
                    )
                } else {
                    let target = active_target
                        .as_ref()
                        .map(|entry| entry.title.as_str())
                        .unwrap_or("the selected window");
                    format!("{} is active on {target}.", preset_label(active_preset))
                }
            }
            LensStatus::Suspended => {
                if covered_count > 1 {
                    format!(
                        "{} is paused for {} windows from the same app.",
                        preset_label(active_preset),
                        covered_count
                    )
                } else if let Some(target) = active_target.as_ref() {
                    format!(
                        "{} is paused for {}.",
                        preset_label(active_preset),
                        target.title
                    )
                } else {
                    "The current effect is paused.".to_string()
                }
            }
        };

        let mut snapshot = self
            .shared_snapshot
            .lock()
            .expect("lens snapshot lock poisoned");
        snapshot.status = status;
        snapshot.active_target = active_target;
        snapshot.active_preset = active_preset;
        snapshot.covered_targets = self.covered_targets.clone();
        snapshot.summary = summary;
        snapshot.backend_label = "Windows Magnification backend".to_string();
    }
}

fn enumerate_logical_targets() -> Result<Vec<LogicalWindowCandidate>> {
    let raw_targets = enumerate_raw_windows()?;
    let mut grouped_targets = HashMap::<String, Vec<RawWindowCandidate>>::new();

    for candidate in raw_targets {
        grouped_targets
            .entry(logical_target_id_for(&candidate))
            .or_default()
            .push(candidate);
    }

    let mut logical_targets = grouped_targets
        .into_iter()
        .filter_map(|(logical_target_id, raw_targets)| {
            build_logical_target(logical_target_id, raw_targets)
        })
        .collect::<Vec<_>>();

    apply_secondary_labels(&mut logical_targets);
    logical_targets.sort_by(|left, right| {
        logical_window_sort_key(&left.descriptor)
            .cmp(&logical_window_sort_key(&right.descriptor))
            .then_with(|| left.descriptor.logical_target_id.cmp(&right.descriptor.logical_target_id))
    });

    Ok(logical_targets)
}

fn build_logical_target(
    logical_target_id: String,
    mut raw_targets: Vec<RawWindowCandidate>,
) -> Option<LogicalWindowCandidate> {
    raw_targets.sort_by(|left, right| {
        canonical_target_sort_key(right).cmp(&canonical_target_sort_key(left))
    });
    let canonical_target = raw_targets.first()?.clone();
    let allows_related_window_expansion = !raw_targets.iter().any(is_ambiguous_host_candidate);
    let related_group_key = if allows_related_window_expansion {
        format!("process:{}", canonical_target.process_id)
    } else {
        format!("logical:{}", logical_target_id)
    };

    Some(LogicalWindowCandidate {
        descriptor: WindowDescriptor {
            window_id: canonical_target.window_id.clone(),
            logical_target_id: logical_target_id.clone(),
            secondary_label: None,
            title: canonical_target.title.clone(),
            executable_path: canonical_target.executable_path.clone(),
            process_id: canonical_target.process_id,
            window_class: canonical_target.window_class.clone(),
            bounds: canonical_target.bounds.clone(),
            attachment_state: canonical_target.attachment_state,
            is_foreground: canonical_target.is_foreground,
        },
        raw_targets,
        related_group_key,
        allows_related_window_expansion,
    })
}

fn apply_secondary_labels(candidates: &mut [LogicalWindowCandidate]) {
    let mut title_groups = HashMap::<String, Vec<usize>>::new();
    for (index, candidate) in candidates.iter().enumerate() {
        title_groups
            .entry(candidate.descriptor.title.to_lowercase())
            .or_default()
            .push(index);
    }

    for indices in title_groups.values() {
        if indices.len() <= 1 {
            if let Some(index) = indices.first() {
                candidates[*index].descriptor.secondary_label = None;
            }
            continue;
        }

        let executable_labels = indices
            .iter()
            .filter_map(|index| {
                executable_basename(candidates[*index].descriptor.executable_path.as_deref())
                    .filter(|name| !is_host_process_name(name))
            })
            .collect::<HashSet<_>>();
        let use_executable_labels = executable_labels.len() == indices.len();

        for index in indices {
            candidates[*index].descriptor.secondary_label =
                disambiguation_label(&candidates[*index], use_executable_labels);
        }
    }
}

fn disambiguation_label(
    candidate: &LogicalWindowCandidate,
    use_executable_label: bool,
) -> Option<String> {
    if use_executable_label {
        return executable_basename(candidate.descriptor.executable_path.as_deref())
            .filter(|name| !is_host_process_name(name));
    }

    Some(format!("PID {}", candidate.descriptor.process_id))
}

fn logical_target_id_for(candidate: &RawWindowCandidate) -> String {
    if is_ambiguous_host_candidate(candidate) {
        let normalized_title = normalize_title(&candidate.title);
        if !normalized_title.is_empty() {
            return format!("logical:hosted:{normalized_title}");
        }
    }

    format!("logical:window:{}", candidate.window_id)
}

fn normalize_title(title: &str) -> String {
    title.trim().to_lowercase()
}

fn executable_basename(path: Option<&str>) -> Option<String> {
    path.and_then(|value| Path::new(value).file_name())
        .map(|name| name.to_string_lossy().to_string())
}

fn is_host_process_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "applicationframehost.exe" | "systemsettings.exe"
    )
}

fn is_ambiguous_host_candidate(candidate: &RawWindowCandidate) -> bool {
    candidate.is_cloaked
        || candidate
            .window_class
            .as_deref()
            .map(|class_name| class_name.to_ascii_lowercase().contains("applicationframe"))
            .unwrap_or(false)
        || executable_basename(candidate.executable_path.as_deref())
            .map(|name| is_host_process_name(&name))
            .unwrap_or(false)
}

fn canonical_target_sort_key(candidate: &RawWindowCandidate) -> (u8, u8, u8, u8, i32, i32) {
    let attachment_rank = match candidate.attachment_state {
        WindowAttachmentState::Available => 2,
        WindowAttachmentState::Minimized => 1,
    };

    (
        u8::from(!candidate.is_cloaked),
        attachment_rank,
        u8::from(!is_ambiguous_host_candidate(candidate)),
        u8::from(candidate.is_foreground),
        candidate.bounds.width,
        candidate.bounds.height,
    )
}

fn logical_window_sort_key(descriptor: &WindowDescriptor) -> (String, String, String) {
    (
        descriptor.title.to_lowercase(),
        descriptor
            .secondary_label
            .as_deref()
            .unwrap_or("")
            .to_lowercase(),
        descriptor.logical_target_id.to_lowercase(),
    )
}
