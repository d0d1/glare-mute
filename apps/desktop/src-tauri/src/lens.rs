use anyhow::Result;
use glare_mute_core::{LensSnapshot, VisualPreset, WindowDescriptor};

pub struct LensController {
    inner: LensControllerImpl,
}

impl LensController {
    pub fn new(initially_suspended: bool, apply_to_related_windows: bool) -> Result<Self> {
        Ok(Self {
            inner: LensControllerImpl::new(initially_suspended, apply_to_related_windows)?,
        })
    }

    pub fn attach_window(&self, window_id: &str, preset: VisualPreset) -> Result<LensSnapshot> {
        self.inner.attach_window(window_id, preset)
    }

    pub fn detach(&self) -> Result<LensSnapshot> {
        self.inner.detach()
    }

    pub fn list_windows(&self) -> Result<Vec<WindowDescriptor>> {
        self.inner.list_windows()
    }

    pub fn set_apply_to_related_windows(
        &self,
        apply_to_related_windows: bool,
    ) -> Result<LensSnapshot> {
        self.inner
            .set_apply_to_related_windows(apply_to_related_windows)
    }

    #[allow(dead_code)]
    pub fn set_suspended(&self, suspended: bool) -> Result<LensSnapshot> {
        // Pause remains internal only for startup/debug flows. The product UI no
        // longer exposes it because users had no meaningful distinction from
        // turning the current effect off.
        self.inner.set_suspended(suspended)
    }

    pub fn snapshot(&self) -> Result<LensSnapshot> {
        self.inner.snapshot()
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    use std::sync::Mutex;

    use anyhow::{Result, bail};
    use glare_mute_core::{LensSnapshot, LensStatus, VisualPreset, WindowDescriptor};

    pub struct LensControllerImpl {
        snapshot: Mutex<LensSnapshot>,
    }

    impl LensControllerImpl {
        pub fn new(initially_suspended: bool, _apply_to_related_windows: bool) -> Result<Self> {
            Ok(Self {
                snapshot: Mutex::new(LensSnapshot {
                    status: if initially_suspended {
                        LensStatus::Suspended
                    } else {
                        LensStatus::Detached
                    },
                    active_preset: None,
                    active_target: None,
                    covered_targets: Vec::new(),
                    summary: "Native window effects only run in the Windows desktop shell."
                        .to_string(),
                    backend_label: "Preview backend".to_string(),
                }),
            })
        }

        pub fn attach_window(
            &self,
            _window_id: &str,
            _preset: VisualPreset,
        ) -> Result<LensSnapshot> {
            bail!("Native window effects only run in the Windows desktop shell.")
        }

        pub fn detach(&self) -> Result<LensSnapshot> {
            Ok(self
                .snapshot
                .lock()
                .expect("preview lens lock poisoned")
                .clone())
        }

        pub fn list_windows(&self) -> Result<Vec<WindowDescriptor>> {
            Ok(Vec::new())
        }

        pub fn set_apply_to_related_windows(&self, _enabled: bool) -> Result<LensSnapshot> {
            Ok(self
                .snapshot
                .lock()
                .expect("preview lens lock poisoned")
                .clone())
        }

        #[allow(dead_code)]
        pub fn set_suspended(&self, suspended: bool) -> Result<LensSnapshot> {
            let mut snapshot = self.snapshot.lock().expect("preview lens lock poisoned");
            snapshot.status = if suspended {
                LensStatus::Suspended
            } else {
                LensStatus::Detached
            };
            Ok(snapshot.clone())
        }

        pub fn snapshot(&self) -> Result<LensSnapshot> {
            Ok(self
                .snapshot
                .lock()
                .expect("preview lens lock poisoned")
                .clone())
        }
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use std::collections::HashSet;
    use std::ffi::c_void;
    use std::mem::size_of;
    use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
    use std::sync::{Arc, Mutex};
    use std::thread::{self, JoinHandle};
    use std::time::{Duration, Instant};

    use anyhow::{Context, Result, anyhow, bail};
    use glare_mute_core::{
        LensSnapshot, LensStatus, VisualPreset, WindowAttachmentState, WindowBounds,
        WindowDescriptor,
    };
    use windows::Win32::Foundation::{
        COLORREF, CloseHandle, GetLastError, HWND, LPARAM, LRESULT, RECT,
    };
    use windows::Win32::Graphics::Dwm::{DWMWA_CLOAKED, DwmGetWindowAttribute};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::System::Threading::{
        GetCurrentProcessId, OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
        QueryFullProcessImageNameW,
    };
    use windows::Win32::UI::Magnification::{
        MAGCOLOREFFECT, MAGTRANSFORM, MW_FILTERMODE_EXCLUDE, MagInitialize, MagSetColorEffect,
        MagSetWindowFilterList, MagSetWindowSource, MagSetWindowTransform, MagUninitialize,
        WC_MAGNIFIER,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, EnumWindows,
        GET_WINDOW_CMD, GW_HWNDPREV, GWL_EXSTYLE, GetClassNameW, GetForegroundWindow, GetWindow,
        GetWindowLongW, GetWindowRect, GetWindowTextLengthW, GetWindowTextW,
        GetWindowThreadProcessId, HMENU, HWND_TOP, HWND_TOPMOST, IsIconic, IsWindow,
        IsWindowVisible, LAYERED_WINDOW_ATTRIBUTES_FLAGS, LWA_ALPHA, MSG, PM_REMOVE, PeekMessageW,
        RegisterClassW, SET_WINDOW_POS_FLAGS, SW_HIDE, SW_SHOWNOACTIVATE, SWP_NOACTIVATE,
        SWP_NOOWNERZORDER, SWP_NOZORDER, SetLayeredWindowAttributes, SetWindowPos, ShowWindow,
        TranslateMessage, WINDOW_EX_STYLE, WINDOW_STYLE, WNDCLASSW, WS_CHILD, WS_EX_LAYERED,
        WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP, WS_VISIBLE,
    };
    use windows::core::{BOOL, Error as WindowsError, PCWSTR, w};

    const HOST_CLASS_NAME: PCWSTR = w!("GlareMuteMagnifierHost");
    const THREAD_TICK_INTERVAL: Duration = Duration::from_millis(16);
    const TARGET_SCAN_INTERVAL: Duration = Duration::from_millis(250);

    pub struct LensControllerImpl {
        command_tx: Sender<ControllerCommand>,
        shared_snapshot: Arc<Mutex<LensSnapshot>>,
        worker: Option<JoinHandle<()>>,
    }

    impl LensControllerImpl {
        pub fn new(initially_suspended: bool, apply_to_related_windows: bool) -> Result<Self> {
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

        pub fn attach_window(&self, window_id: &str, preset: VisualPreset) -> Result<LensSnapshot> {
            if !matches!(preset, VisualPreset::GreyscaleInvert | VisualPreset::Invert) {
                bail!("This effect is not implemented in the native Windows path right now.")
            }

            let descriptor = describe_window(parse_window_id(window_id)?)?
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

        pub fn detach(&self) -> Result<LensSnapshot> {
            let (response_tx, response_rx) = mpsc::channel();
            self.command_tx
                .send(ControllerCommand::Detach { response_tx })
                .context("failed to send detach command to lens worker")?;
            response_rx
                .recv()
                .context("failed to receive detach confirmation from lens worker")??;

            self.snapshot()
        }

        pub fn list_windows(&self) -> Result<Vec<WindowDescriptor>> {
            enumerate_attachable_windows()
        }

        pub fn set_apply_to_related_windows(&self, enabled: bool) -> Result<LensSnapshot> {
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

        pub fn set_suspended(&self, suspended: bool) -> Result<LensSnapshot> {
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

        pub fn snapshot(&self) -> Result<LensSnapshot> {
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

    struct AttachmentSession {
        active_window_id: String,
        process_id: u32,
        preset: VisualPreset,
    }

    struct OverlaySurface {
        target_window_id: String,
        target_hwnd: HWND,
        host_hwnd: HWND,
        magnifier_hwnd: HWND,
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

    struct PresentationTarget {
        rect: RECT,
        insert_after: HWND,
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
                Ok(ControllerCommand::Shutdown) => {
                    should_exit = true;
                }
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => {
                    should_exit = true;
                }
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
            let target_hwnd = parse_window_id(&descriptor.window_id)?;
            if unsafe { !IsWindow(Some(target_hwnd)).as_bool() } {
                bail!("The selected window is no longer valid.");
            }

            tracing::info!(
                window_id = %descriptor.window_id,
                title = %descriptor.title,
                preset = ?preset,
                process_id = descriptor.process_id,
                apply_to_related_windows = self.apply_to_related_windows,
                "attaching magnifier backend"
            );

            self.session = Some(AttachmentSession {
                active_window_id: descriptor.window_id.clone(),
                process_id: descriptor.process_id,
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

            let active_window_id = session.active_window_id.clone();
            let process_id = session.process_id;
            let preset = session.preset;
            let mut covered_targets = enumerate_attachable_windows()?
                .into_iter()
                .filter(|candidate| {
                    if self.apply_to_related_windows {
                        candidate.process_id == process_id
                    } else {
                        candidate.window_id == active_window_id
                    }
                })
                .collect::<Vec<_>>();

            if covered_targets.is_empty() {
                tracing::info!(
                    process_id,
                    "no covered windows remain for the current session"
                );
                self.clear_session()?;
                self.update_shared_snapshot();
                return Ok(());
            }

            if !covered_targets
                .iter()
                .any(|candidate| candidate.window_id == active_window_id)
            {
                if let Some(session) = self.session.as_mut() {
                    session.active_window_id = covered_targets[0].window_id.clone();
                }
            }

            self.covered_targets.clear();
            self.covered_targets.append(&mut covered_targets);
            self.reconcile_surfaces(preset)?;
            self.update_shared_snapshot();
            Ok(())
        }

        fn reconcile_surfaces(&mut self, preset: VisualPreset) -> Result<()> {
            let desired_targets = self
                .covered_targets
                .iter()
                .filter(|candidate| candidate.attachment_state == WindowAttachmentState::Available)
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
                    .push(OverlaySurface::create(&descriptor, preset)?);
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
                .find(|candidate| candidate.window_id == session.active_window_id)
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

    impl OverlaySurface {
        fn create(target: &WindowDescriptor, preset: VisualPreset) -> Result<Self> {
            let instance = unsafe {
                GetModuleHandleW(None).context("failed to resolve module handle for host window")?
            };
            let host_hwnd = unsafe {
                CreateWindowExW(
                    WINDOW_EX_STYLE(
                        WS_EX_LAYERED.0
                            | WS_EX_TRANSPARENT.0
                            | WS_EX_TOOLWINDOW.0
                            | WS_EX_NOACTIVATE.0,
                    ),
                    HOST_CLASS_NAME,
                    w!("GlareMute Lens"),
                    WS_POPUP,
                    0,
                    0,
                    0,
                    0,
                    None,
                    None,
                    Some(instance.into()),
                    None,
                )
            }
            .context("failed to create magnifier host window")?;

            unsafe {
                SetLayeredWindowAttributes(
                    host_hwnd,
                    COLORREF(0),
                    255,
                    LAYERED_WINDOW_ATTRIBUTES_FLAGS(LWA_ALPHA.0),
                )
                .context("failed to configure layered magnifier host window")?;
            }

            let magnifier_hwnd = unsafe {
                CreateWindowExW(
                    WINDOW_EX_STYLE(0),
                    WC_MAGNIFIER,
                    w!("GlareMute Magnifier"),
                    WINDOW_STYLE(WS_CHILD.0 | WS_VISIBLE.0),
                    0,
                    0,
                    0,
                    0,
                    Some(host_hwnd),
                    Some(HMENU::default()),
                    Some(instance.into()),
                    None,
                )
            }
            .context("failed to create magnifier control")?;

            let mut transform = identity_transform();
            unsafe {
                ensure_bool(
                    MagSetWindowTransform(magnifier_hwnd, &mut transform),
                    "failed to configure magnifier transform",
                )?;
            }

            let mut surface = Self {
                target_window_id: target.window_id.clone(),
                target_hwnd: parse_window_id(&target.window_id)?,
                host_hwnd,
                magnifier_hwnd,
            };
            surface.set_effect(preset)?;
            surface.hide();
            Ok(surface)
        }

        fn set_effect(&mut self, preset: VisualPreset) -> Result<()> {
            let mut effect = effect_for_preset(preset)?;
            unsafe {
                ensure_bool(
                    MagSetColorEffect(self.magnifier_hwnd, &mut effect),
                    "failed to apply the selected color effect",
                )?;
            }

            Ok(())
        }

        fn present(&mut self, target: PresentationTarget) -> Result<()> {
            let rect = target.rect;
            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;
            if width <= 0 || height <= 0 {
                self.hide();
                return Ok(());
            }

            unsafe {
                SetWindowPos(
                    self.host_hwnd,
                    Some(target.insert_after),
                    rect.left,
                    rect.top,
                    width,
                    height,
                    SET_WINDOW_POS_FLAGS(SWP_NOACTIVATE.0 | SWP_NOOWNERZORDER.0),
                )
                .context("failed to position the magnifier host window")?;
                SetWindowPos(
                    self.magnifier_hwnd,
                    None,
                    0,
                    0,
                    width,
                    height,
                    SET_WINDOW_POS_FLAGS(SWP_NOACTIVATE.0 | SWP_NOZORDER.0),
                )
                .context("failed to size the magnifier control")?;
                ensure_bool(
                    MagSetWindowSource(self.magnifier_hwnd, rect),
                    "failed to update the magnifier source rectangle",
                )?;
                let _ = ShowWindow(self.host_hwnd, SW_SHOWNOACTIVATE);
            }

            Ok(())
        }

        fn hide(&self) {
            unsafe {
                let _ = ShowWindow(self.host_hwnd, SW_HIDE);
            }
        }

        fn destroy(self) -> Result<()> {
            unsafe {
                let _ = ShowWindow(self.host_hwnd, SW_HIDE);
                DestroyWindow(self.magnifier_hwnd)
                    .context("failed to destroy the magnifier control")?;
                DestroyWindow(self.host_hwnd)
                    .context("failed to destroy the magnifier host window")?;
            }

            Ok(())
        }
    }

    fn enumerate_attachable_windows() -> Result<Vec<WindowDescriptor>> {
        let mut windows = Vec::new();
        let windows_ptr = &mut windows as *mut Vec<WindowDescriptor>;

        unsafe {
            EnumWindows(Some(enum_windows_callback), LPARAM(windows_ptr as isize))
                .context("failed to enumerate top-level windows")?;
        }

        windows.sort_by(|left: &WindowDescriptor, right: &WindowDescriptor| {
            window_sort_key(left)
                .cmp(&window_sort_key(right))
                .then_with(|| left.window_id.cmp(&right.window_id))
        });
        let available_count = windows
            .iter()
            .filter(|entry| entry.attachment_state == WindowAttachmentState::Available)
            .count();
        let minimized_count = windows.len().saturating_sub(available_count);
        tracing::debug!(
            candidate_count = windows.len(),
            available_count,
            minimized_count,
            "enumerated window candidates"
        );
        Ok(windows)
    }

    unsafe extern "system" fn enum_windows_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let windows = unsafe { &mut *(lparam.0 as *mut Vec<WindowDescriptor>) };

        if let Ok(Some(descriptor)) = describe_window(hwnd) {
            windows.push(descriptor);
        }

        BOOL(1)
    }

    fn describe_window(hwnd: HWND) -> Result<Option<WindowDescriptor>> {
        if hwnd.0.is_null() {
            return Ok(None);
        }

        unsafe {
            if !IsWindow(Some(hwnd)).as_bool() || !IsWindowVisible(hwnd).as_bool() {
                return Ok(None);
            }
            if (GetWindowLongW(hwnd, GWL_EXSTYLE) as u32 & WS_EX_TOOLWINDOW.0) != 0 {
                return Ok(None);
            }
        }

        let mut process_id = 0;
        unsafe {
            GetWindowThreadProcessId(hwnd, Some(&mut process_id));
        }
        if process_id == unsafe { GetCurrentProcessId() } {
            return Ok(None);
        }

        let bounds = match window_bounds(hwnd)? {
            Some(bounds) => bounds,
            None => return Ok(None),
        };

        let title = window_text(hwnd)?;
        let executable_path = process_image_path(process_id).ok();
        if title.trim().is_empty() && executable_path.is_none() {
            return Ok(None);
        }

        Ok(Some(WindowDescriptor {
            window_id: format_window_id(hwnd),
            title: if title.trim().is_empty() {
                executable_path
                    .as_ref()
                    .and_then(|path| std::path::Path::new(path).file_name())
                    .map(|name| name.to_string_lossy().into_owned())
                    .unwrap_or_else(|| "Untitled window".to_string())
            } else {
                title
            },
            executable_path,
            process_id,
            window_class: class_name(hwnd)?,
            bounds,
            attachment_state: if unsafe { IsIconic(hwnd).as_bool() } {
                WindowAttachmentState::Minimized
            } else {
                WindowAttachmentState::Available
            },
            is_foreground: hwnd == unsafe { GetForegroundWindow() },
        }))
    }

    fn presentation_target(hwnd: HWND, host_hwnd: HWND) -> Result<Option<PresentationTarget>> {
        unsafe {
            if !IsWindow(Some(hwnd)).as_bool()
                || !IsWindowVisible(hwnd).as_bool()
                || IsIconic(hwnd).as_bool()
            {
                return Ok(None);
            }
        }

        if is_window_cloaked(hwnd) {
            return Ok(None);
        }

        let mut rect = RECT::default();
        unsafe {
            GetWindowRect(hwnd, &mut rect).context("failed to read target window bounds")?;
        }

        if rect.right <= rect.left || rect.bottom <= rect.top {
            return Ok(None);
        }

        Ok(Some(PresentationTarget {
            rect,
            insert_after: desired_host_insert_after(hwnd, host_hwnd)?,
        }))
    }

    fn desired_host_insert_after(target_hwnd: HWND, host_hwnd: HWND) -> Result<HWND> {
        let target_is_topmost = is_topmost_window(target_hwnd);
        let mut above_target = unsafe { GetWindow(target_hwnd, GET_WINDOW_CMD(GW_HWNDPREV.0)) }
            .context("failed to inspect target z-order")?;

        if above_target == host_hwnd {
            above_target = unsafe { GetWindow(host_hwnd, GET_WINDOW_CMD(GW_HWNDPREV.0)) }
                .context("failed to inspect overlay z-order")?;
        }

        if above_target.0.is_null() {
            return Ok(if target_is_topmost {
                HWND_TOPMOST
            } else {
                HWND_TOP
            });
        }

        if !target_is_topmost && is_topmost_window(above_target) {
            return Ok(HWND_TOP);
        }

        Ok(above_target)
    }

    fn is_topmost_window(hwnd: HWND) -> bool {
        unsafe { (GetWindowLongW(hwnd, GWL_EXSTYLE) as u32 & WS_EX_TOPMOST.0) != 0 }
    }

    fn is_window_cloaked(hwnd: HWND) -> bool {
        let mut cloaked = 0u32;
        unsafe {
            if DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED,
                &mut cloaked as *mut _ as *mut c_void,
                size_of::<u32>() as u32,
            )
            .is_err()
            {
                return false;
            }
        }

        cloaked != 0
    }

    fn window_bounds(hwnd: HWND) -> Result<Option<WindowBounds>> {
        let mut rect = RECT::default();
        unsafe {
            GetWindowRect(hwnd, &mut rect).context("failed to read window bounds")?;
        }

        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width <= 0 || height <= 0 {
            return Ok(None);
        }

        Ok(Some(WindowBounds {
            left: rect.left,
            top: rect.top,
            width,
            height,
        }))
    }

    fn window_text(hwnd: HWND) -> Result<String> {
        let length = unsafe { GetWindowTextLengthW(hwnd) };
        if length == 0 {
            return Ok(String::new());
        }

        let mut buffer = vec![0u16; length as usize + 1];
        let written = unsafe { GetWindowTextW(hwnd, &mut buffer) };
        Ok(String::from_utf16_lossy(&buffer[..written as usize]))
    }

    fn class_name(hwnd: HWND) -> Result<Option<String>> {
        let mut buffer = vec![0u16; 256];
        let written = unsafe { GetClassNameW(hwnd, &mut buffer) };
        if written == 0 {
            return Ok(None);
        }

        Ok(Some(String::from_utf16_lossy(&buffer[..written as usize])))
    }

    fn process_image_path(process_id: u32) -> Result<String> {
        let handle = unsafe {
            OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id)
                .context("failed to open target process")?
        };

        let mut buffer = vec![0u16; 1024];
        let mut size = buffer.len() as u32;
        unsafe {
            QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                windows::core::PWSTR(buffer.as_mut_ptr()),
                &mut size,
            )
            .context("failed to resolve the target executable path")?;
            let _ = CloseHandle(handle);
        }

        Ok(String::from_utf16_lossy(&buffer[..size as usize]))
    }

    fn parse_window_id(window_id: &str) -> Result<HWND> {
        let trimmed = window_id.trim();
        let raw = trimmed
            .strip_prefix("0x")
            .or_else(|| trimmed.strip_prefix("0X"))
            .unwrap_or(trimmed);
        let value = u64::from_str_radix(raw, 16)
            .with_context(|| format!("failed to parse window id {window_id}"))?;
        Ok(HWND(value as usize as *mut c_void))
    }

    fn format_window_id(hwnd: HWND) -> String {
        format!("0x{:X}", hwnd.0 as usize)
    }

    fn register_host_window_class() -> Result<()> {
        let instance = unsafe {
            GetModuleHandleW(None).context("failed to resolve module handle for host class")?
        };
        let window_class = WNDCLASSW {
            hInstance: instance.into(),
            lpszClassName: HOST_CLASS_NAME,
            lpfnWndProc: Some(host_window_proc),
            ..Default::default()
        };

        let atom = unsafe { RegisterClassW(&window_class) };
        if atom == 0 {
            let error = unsafe { GetLastError() };
            if error.0 != 1410 {
                return Err(WindowsError::from_win32().into());
            }
        }

        Ok(())
    }

    extern "system" fn host_window_proc(
        hwnd: HWND,
        message: u32,
        wparam: windows::Win32::Foundation::WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        unsafe { DefWindowProcW(hwnd, message, wparam, lparam) }
    }

    fn identity_transform() -> MAGTRANSFORM {
        let mut matrix = MAGTRANSFORM::default();
        matrix.v[0] = 1.0;
        matrix.v[4] = 1.0;
        matrix.v[8] = 1.0;
        matrix
    }

    fn greyscale_invert_effect() -> MAGCOLOREFFECT {
        MAGCOLOREFFECT {
            transform: [
                -0.3, -0.3, -0.3, 0.0, 0.0, -0.6, -0.6, -0.6, 0.0, 0.0, -0.1, -0.1, -0.1, 0.0, 0.0,
                0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 0.0, 1.0,
            ],
        }
    }

    fn invert_effect() -> MAGCOLOREFFECT {
        MAGCOLOREFFECT {
            transform: [
                -1.0, 0.0, 0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 0.0, 1.0,
            ],
        }
    }

    fn effect_for_preset(preset: VisualPreset) -> Result<MAGCOLOREFFECT> {
        match preset {
            VisualPreset::Invert => Ok(invert_effect()),
            VisualPreset::GreyscaleInvert => Ok(greyscale_invert_effect()),
            VisualPreset::WarmDim => {
                bail!("Warm Dim is not implemented in the native Windows path right now.")
            }
        }
    }

    fn preset_label(preset: Option<VisualPreset>) -> &'static str {
        match preset.unwrap_or(VisualPreset::GreyscaleInvert) {
            VisualPreset::Invert => "Invert",
            VisualPreset::WarmDim => "Warm Dim",
            VisualPreset::GreyscaleInvert => "Greyscale Invert",
        }
    }

    fn window_sort_key(descriptor: &WindowDescriptor) -> (String, String, String) {
        (
            descriptor.title.to_lowercase(),
            descriptor
                .executable_path
                .as_deref()
                .unwrap_or("")
                .to_lowercase(),
            descriptor
                .window_class
                .as_deref()
                .unwrap_or("")
                .to_lowercase(),
        )
    }

    fn ensure_bool(result: BOOL, context: &str) -> Result<()> {
        if result.as_bool() {
            Ok(())
        } else {
            Err(anyhow!("{context}: {}", WindowsError::from_win32()))
        }
    }

    fn pump_messages() -> Result<bool> {
        let mut message = MSG::default();
        let has_message = unsafe { PeekMessageW(&mut message, None, 0, 0, PM_REMOVE) }.as_bool();
        if !has_message {
            return Ok(false);
        }

        unsafe {
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }

        Ok(true)
    }
}

#[cfg(not(target_os = "windows"))]
use platform::LensControllerImpl;
#[cfg(target_os = "windows")]
use platform::LensControllerImpl;
