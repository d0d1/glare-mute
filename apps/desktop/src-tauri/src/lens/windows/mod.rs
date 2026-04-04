mod effects;
mod overlay;
mod windowing;

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use anyhow::{Context, Result, bail};
use glare_mute_core::{
    LensSnapshot, LensStatus, ProfileRule, ProfileSnapshot, VisualPreset,
    WindowAttachmentState, WindowDescriptor,
};
use windows::Win32::UI::Magnification::{
    MW_FILTERMODE_EXCLUDE, MagInitialize, MagSetWindowFilterList, MagUninitialize,
};

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
            covered_targets: Vec::new(),
            profile_snapshots: Vec::new(),
            summary: if initially_suspended {
                "Saved effects are paused.".to_string()
            } else {
                "No saved apps are active.".to_string()
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

    pub(super) fn set_profiles(&self, profiles: Vec<ProfileRule>) -> Result<LensSnapshot> {
        let (response_tx, response_rx) = mpsc::channel();

        self.command_tx
            .send(ControllerCommand::SetProfiles {
                profiles,
                response_tx,
            })
            .context("failed to send profile update command to lens worker")?;
        response_rx
            .recv()
            .context("failed to receive profile update confirmation from lens worker")??;

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
    SetProfiles {
        profiles: Vec<ProfileRule>,
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

#[derive(Clone)]
struct SurfaceAssignment {
    target_window_id: String,
    raw_target: RawWindowCandidate,
    preset: VisualPreset,
}

struct WorkerState {
    shared_snapshot: Arc<Mutex<LensSnapshot>>,
    profiles: Vec<ProfileRule>,
    covered_targets: Vec<WindowDescriptor>,
    profile_snapshots: Vec<ProfileSnapshot>,
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
            Ok(ControllerCommand::SetProfiles {
                profiles,
                response_tx,
            }) => {
                let result = runtime.set_profiles(profiles);
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
            profiles: Vec::new(),
            covered_targets: Vec::new(),
            profile_snapshots: Vec::new(),
            surfaces: Vec::new(),
            suspended: false,
            apply_to_related_windows,
            last_target_scan: Instant::now() - TARGET_SCAN_INTERVAL,
        })
    }

    fn set_profiles(&mut self, profiles: Vec<ProfileRule>) -> Result<()> {
        for profile in &profiles {
            if !matches!(profile.preset, VisualPreset::GreyscaleInvert | VisualPreset::Invert) {
                bail!("This effect is not implemented in the native Windows path right now.");
            }
        }

        self.profiles = profiles;
        self.last_target_scan = Instant::now() - TARGET_SCAN_INTERVAL;
        self.sync_targets(true)?;
        self.tick();
        tracing::info!(
            enabled_profiles = self.profiles.iter().filter(|profile| profile.enabled).count(),
            apply_to_related_windows = self.apply_to_related_windows,
            "updated magnifier profile set"
        );
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
            tracing::warn!(?error, "failed to refresh saved app coverage");
            let _ = self.clear_runtime_state();
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
        self.clear_runtime_state()
    }

    fn sync_targets(&mut self, force: bool) -> Result<()> {
        if !force && self.last_target_scan.elapsed() < TARGET_SCAN_INTERVAL {
            return Ok(());
        }
        self.last_target_scan = Instant::now();

        if self.profiles.is_empty() {
            self.clear_runtime_state()?;
            self.update_shared_snapshot();
            return Ok(());
        }

        let logical_targets = enumerate_logical_targets()?;

        let mut covered_targets = Vec::new();
        let mut covered_ids = HashSet::new();
        let mut profile_snapshots = Vec::with_capacity(self.profiles.len());
        let mut desired_assignments = Vec::new();
        let mut assigned_window_ids = HashSet::new();

        for profile in &self.profiles {
            let matching_candidates = resolve_profile_targets(
                profile,
                &logical_targets,
                self.apply_to_related_windows,
            );
            let matching_targets = matching_candidates
                .iter()
                .map(|candidate| candidate.descriptor.clone())
                .collect::<Vec<_>>();

            if profile.enabled {
                for descriptor in &matching_targets {
                    if covered_ids.insert(descriptor.logical_target_id.clone()) {
                        covered_targets.push(descriptor.clone());
                    }
                }

                for raw_target in matching_candidates
                    .iter()
                    .flat_map(|candidate| candidate.raw_targets.iter())
                    .filter(|candidate| {
                        candidate.attachment_state == WindowAttachmentState::Available
                            && !candidate.is_cloaked
                    })
                {
                    if assigned_window_ids.insert(raw_target.window_id.clone()) {
                        desired_assignments.push(SurfaceAssignment {
                            target_window_id: raw_target.window_id.clone(),
                            raw_target: raw_target.clone(),
                            preset: profile.preset,
                        });
                    }
                }
            }

            profile_snapshots.push(ProfileSnapshot {
                profile_id: profile.id.clone(),
                label: profile_label(profile),
                enabled: profile.enabled,
                preset: profile.preset,
                matching_targets,
            });
        }

        self.covered_targets = covered_targets;
        self.profile_snapshots = profile_snapshots;
        self.reconcile_surfaces(&desired_assignments)?;
        self.update_shared_snapshot();
        Ok(())
    }

    fn reconcile_surfaces(&mut self, desired_targets: &[SurfaceAssignment]) -> Result<()> {
        let desired_ids = desired_targets
            .iter()
            .map(|candidate| candidate.target_window_id.clone())
            .collect::<HashSet<_>>();
        let desired_by_id = desired_targets
            .iter()
            .map(|assignment| (assignment.target_window_id.as_str(), assignment))
            .collect::<HashMap<_, _>>();

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
            if let Some(assignment) = desired_by_id.get(surface.target_window_id.as_str()) {
                surface.set_effect(assignment.preset)?;
            }
        }

        for assignment in desired_targets {
            if self
                .surfaces
                .iter()
                .any(|surface| surface.target_window_id == assignment.target_window_id)
            {
                continue;
            }

            self.surfaces
                .push(OverlaySurface::create(
                    &assignment.raw_target.window_id,
                    assignment.preset,
                )?);
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

    fn clear_runtime_state(&mut self) -> Result<()> {
        self.covered_targets.clear();
        self.profile_snapshots.clear();

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

    fn status(&self) -> LensStatus {
        let enabled_profiles = self.profiles.iter().filter(|profile| profile.enabled).count();
        if enabled_profiles == 0 {
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
        let visible_count = self
            .covered_targets
            .iter()
            .filter(|candidate| candidate.attachment_state == WindowAttachmentState::Available)
            .count();
        let enabled_count = self.profiles.iter().filter(|profile| profile.enabled).count();
        let summary = match status {
            LensStatus::Detached => "No saved apps are active.".to_string(),
            LensStatus::Pending => {
                if enabled_count == 1 {
                    "A saved effect is waiting for a matching window.".to_string()
                } else {
                    format!("{enabled_count} saved effects are waiting for matching windows.")
                }
            }
            LensStatus::Attached => format!(
                "Effects are active on {} windows across {} saved apps.",
                visible_count.max(1),
                enabled_count.max(1)
            ),
            LensStatus::Suspended => "Saved effects are paused.".to_string(),
        };

        let mut snapshot = self
            .shared_snapshot
            .lock()
            .expect("lens snapshot lock poisoned");
        snapshot.status = status;
        snapshot.covered_targets = self.covered_targets.clone();
        snapshot.profile_snapshots = self.profile_snapshots.clone();
        snapshot.summary = summary;
        snapshot.backend_label = "Windows Magnification backend".to_string();
    }
}

fn resolve_profile_targets(
    profile: &ProfileRule,
    logical_targets: &[LogicalWindowCandidate],
    apply_to_related_windows: bool,
) -> Vec<LogicalWindowCandidate> {
    if !profile.enabled {
        return Vec::new();
    }

    let matched_targets = logical_targets
        .iter()
        .filter(|candidate| profile_matches_candidate(profile, &candidate.descriptor))
        .cloned()
        .collect::<Vec<_>>();

    if !apply_to_related_windows {
        return matched_targets;
    }

    let related_group_keys = matched_targets
        .iter()
        .filter(|candidate| candidate.allows_related_window_expansion)
        .map(|candidate| candidate.related_group_key.clone())
        .collect::<HashSet<_>>();

    if related_group_keys.is_empty() {
        return matched_targets;
    }

    let mut expanded_targets = Vec::new();
    let mut seen = HashSet::new();
    for candidate in logical_targets {
        if (profile_matches_candidate(profile, &candidate.descriptor)
            || related_group_keys.contains(&candidate.related_group_key))
            && seen.insert(candidate.descriptor.logical_target_id.clone())
        {
            expanded_targets.push(candidate.clone());
        }
    }

    expanded_targets
}

fn profile_matches_candidate(profile: &ProfileRule, candidate: &WindowDescriptor) -> bool {
    let Some(candidate_path) = candidate.executable_path.as_deref() else {
        return false;
    };

    if !profile.executable_path.eq_ignore_ascii_case(candidate_path) {
        return false;
    }

    if let Some(window_class) = profile.window_class.as_deref() {
        let Some(candidate_class) = candidate.window_class.as_deref() else {
            return false;
        };

        if !window_class.eq_ignore_ascii_case(candidate_class) {
            return false;
        }
    }

    if let Some(title_pattern) = profile.title_pattern.as_deref() {
        let normalized_pattern = title_pattern.trim().to_lowercase();
        if normalized_pattern.is_empty() {
            return true;
        }

        return candidate.title.to_lowercase().contains(&normalized_pattern);
    }

    true
}

fn profile_label(profile: &ProfileRule) -> String {
    if !profile.label.trim().is_empty() {
        return profile.label.clone();
    }

    executable_basename(Some(profile.executable_path.as_str())).unwrap_or_else(|| {
        profile.executable_path.clone()
    })
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
            .then_with(|| {
                left.descriptor
                    .logical_target_id
                    .cmp(&right.descriptor.logical_target_id)
            })
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
    if !should_surface_logical_target(&canonical_target) {
        return None;
    }

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

fn should_surface_logical_target(candidate: &RawWindowCandidate) -> bool {
    let normalized_title = normalize_title(&candidate.title);
    let executable_name = executable_basename(candidate.executable_path.as_deref())
        .map(|name| name.to_ascii_lowercase());

    if normalized_title == "windows input experience" {
        return false;
    }

    if normalized_title == "explorer.exe" && executable_name.as_deref() == Some("explorer.exe") {
        return false;
    }

    true
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

#[cfg(test)]
mod tests {
    use super::*;
    use glare_mute_core::WindowBounds;

    fn raw_candidate(title: &str, executable_path: Option<&str>) -> RawWindowCandidate {
        RawWindowCandidate {
            window_id: "0x1000".to_string(),
            title: title.to_string(),
            executable_path: executable_path.map(ToString::to_string),
            process_id: 4242,
            window_class: Some("CabinetWClass".to_string()),
            bounds: WindowBounds {
                left: 0,
                top: 0,
                width: 800,
                height: 600,
            },
            attachment_state: WindowAttachmentState::Available,
            is_foreground: true,
            is_cloaked: false,
        }
    }

    #[test]
    fn hides_bare_explorer_fallback_rows() {
        let candidate = raw_candidate("explorer.exe", Some("C:\\Windows\\explorer.exe"));
        assert!(!should_surface_logical_target(&candidate));
    }

    #[test]
    fn keeps_real_file_explorer_windows_targetable() {
        let candidate = raw_candidate(
            "Documents - File Explorer",
            Some("C:\\Windows\\explorer.exe"),
        );
        assert!(should_surface_logical_target(&candidate));
    }

    #[test]
    fn hides_windows_input_experience_rows() {
        let candidate = raw_candidate(
            "Windows Input Experience",
            Some(
                "C:\\Windows\\SystemApps\\MicrosoftWindows.Client.CBS_cw5n1h2txyewy\\TextInputHost.exe",
            ),
        );
        assert!(!should_surface_logical_target(&candidate));
    }
}
