use anyhow::Result;
use glare_mute_core::{LensSnapshot, VisualPreset, WindowDescriptor};

pub struct LensController {
    inner: LensControllerImpl,
}

impl LensController {
    pub fn new(initially_suspended: bool) -> Result<Self> {
        Ok(Self {
            inner: LensControllerImpl::new(initially_suspended)?,
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

    pub fn set_suspended(&self, suspended: bool) -> Result<LensSnapshot> {
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
        pub fn new(initially_suspended: bool) -> Result<Self> {
            Ok(Self {
                snapshot: Mutex::new(LensSnapshot {
                    status: if initially_suspended {
                        LensStatus::Suspended
                    } else {
                        LensStatus::Detached
                    },
                    active_preset: None,
                    active_target: None,
                    summary: "Native window attachment only runs in the Windows desktop shell."
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
            bail!("Native window attachment only runs in the Windows desktop shell.")
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
    use std::ffi::c_void;
    use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
    use std::sync::{Arc, Mutex};
    use std::thread::{self, JoinHandle};
    use std::time::Duration;

    use anyhow::{Context, Result, anyhow, bail};
    use glare_mute_core::{
        LensSnapshot, LensStatus, VisualPreset, WindowAttachmentState, WindowBounds,
        WindowDescriptor,
    };
    use windows::Win32::Foundation::{
        COLORREF, CloseHandle, GetLastError, HWND, LPARAM, LRESULT, RECT,
    };
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
        GA_ROOTOWNER, GWL_EXSTYLE, GetAncestor, GetClassNameW, GetForegroundWindow, GetWindowLongW,
        GetWindowRect, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, HMENU,
        HWND_TOPMOST, IsIconic, IsWindow, IsWindowVisible, LAYERED_WINDOW_ATTRIBUTES_FLAGS,
        LWA_ALPHA, MSG, PM_REMOVE, PeekMessageW, RegisterClassW, SET_WINDOW_POS_FLAGS, SW_HIDE,
        SW_SHOWNOACTIVATE, SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_NOZORDER,
        SetLayeredWindowAttributes, SetWindowPos, ShowWindow, TranslateMessage, WINDOW_EX_STYLE,
        WINDOW_STYLE, WNDCLASSW, WS_CHILD, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
        WS_EX_TRANSPARENT, WS_POPUP, WS_VISIBLE,
    };
    use windows::core::{BOOL, Error as WindowsError, PCWSTR, w};

    const HOST_CLASS_NAME: PCWSTR = w!("GlareMuteMagnifierHost");
    const THREAD_TICK_INTERVAL: Duration = Duration::from_millis(16);

    pub struct LensControllerImpl {
        command_tx: Sender<ControllerCommand>,
        shared_snapshot: Arc<Mutex<LensSnapshot>>,
        worker: Option<JoinHandle<()>>,
    }

    impl LensControllerImpl {
        pub fn new(initially_suspended: bool) -> Result<Self> {
            let shared_snapshot = Arc::new(Mutex::new(LensSnapshot {
                status: if initially_suspended {
                    LensStatus::Suspended
                } else {
                    LensStatus::Detached
                },
                active_preset: None,
                active_target: None,
                summary: if initially_suspended {
                    "Lens output is suspended before any window is attached.".to_string()
                } else {
                    "No window is attached. Refresh the window list and attach Greyscale Invert."
                        .to_string()
                },
                backend_label: "Windows Magnification backend".to_string(),
            }));
            let (command_tx, command_rx) = mpsc::channel();
            let worker_snapshot = Arc::clone(&shared_snapshot);

            let worker = thread::Builder::new()
                .name("glaremute-lens".to_string())
                .spawn(move || {
                    if let Err(error) = lens_thread_main(command_rx, worker_snapshot) {
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
            if preset != VisualPreset::GreyscaleInvert {
                bail!("Only Greyscale Invert is implemented in the native Windows path right now.")
            }

            let descriptor = describe_window(parse_window_id(window_id)?)?
                .ok_or_else(|| anyhow!("The selected window is no longer available."))?;
            if descriptor.attachment_state != WindowAttachmentState::Available {
                bail!("Restore the selected window before attaching the lens.")
            }
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
        SetSuspended {
            suspended: bool,
            response_tx: Sender<Result<()>>,
        },
        Shutdown,
    }

    struct WorkerState {
        magnifier_hwnd: HWND,
        host_hwnd: HWND,
        shared_snapshot: Arc<Mutex<LensSnapshot>>,
        current_target: Option<WindowDescriptor>,
        current_target_hwnd: Option<HWND>,
        current_preset: Option<VisualPreset>,
        suspended: bool,
    }

    fn lens_thread_main(
        command_rx: Receiver<ControllerCommand>,
        shared_snapshot: Arc<Mutex<LensSnapshot>>,
    ) -> Result<()> {
        unsafe {
            ensure_bool(MagInitialize(), "failed to initialize Magnification API")?;
        }

        let mut runtime = match WorkerState::create(shared_snapshot) {
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
        fn create(shared_snapshot: Arc<Mutex<LensSnapshot>>) -> Result<Self> {
            register_host_window_class()?;

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

            let mut filter_windows = [host_hwnd];
            unsafe {
                ensure_bool(
                    MagSetWindowFilterList(
                        magnifier_hwnd,
                        MW_FILTERMODE_EXCLUDE,
                        filter_windows.len() as i32,
                        filter_windows.as_mut_ptr(),
                    ),
                    "failed to exclude the host window from magnification",
                )?;
            }

            let mut transform = identity_transform();
            unsafe {
                ensure_bool(
                    MagSetWindowTransform(magnifier_hwnd, &mut transform),
                    "failed to configure magnifier transform",
                )?;
                let _ = ShowWindow(host_hwnd, SW_HIDE);
            }

            Ok(Self {
                magnifier_hwnd,
                host_hwnd,
                shared_snapshot,
                current_target: None,
                current_target_hwnd: None,
                current_preset: None,
                suspended: false,
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
                "attaching magnifier backend"
            );

            self.current_target = Some(descriptor.clone());
            self.current_target_hwnd = Some(target_hwnd);
            self.current_preset = Some(preset);

            let mut effect = greyscale_invert_effect();
            unsafe {
                ensure_bool(
                    MagSetColorEffect(self.magnifier_hwnd, &mut effect),
                    "failed to apply the greyscale invert color effect",
                )?;
            }

            self.update_shared_snapshot(LensStatus::Attached, Some(descriptor), Some(preset));
            self.tick();
            Ok(())
        }

        fn detach(&mut self) -> Result<()> {
            self.current_target = None;
            self.current_target_hwnd = None;
            self.current_preset = None;

            unsafe {
                let _ = ShowWindow(self.host_hwnd, SW_HIDE);
            }

            self.update_shared_snapshot(
                if self.suspended {
                    LensStatus::Suspended
                } else {
                    LensStatus::Detached
                },
                None,
                None,
            );
            tracing::info!("detached magnifier backend");
            Ok(())
        }

        fn set_suspended(&mut self, suspended: bool) -> Result<()> {
            self.suspended = suspended;
            if suspended {
                unsafe {
                    let _ = ShowWindow(self.host_hwnd, SW_HIDE);
                }
            }

            self.update_shared_snapshot(
                if suspended {
                    LensStatus::Suspended
                } else if self.current_target.is_some() {
                    LensStatus::Attached
                } else {
                    LensStatus::Detached
                },
                self.current_target.clone(),
                self.current_preset,
            );
            tracing::info!(suspended, "updated lens suspended state");
            Ok(())
        }

        fn tick(&mut self) {
            let Some(target_hwnd) = self.current_target_hwnd else {
                return;
            };

            if self.suspended {
                unsafe {
                    let _ = ShowWindow(self.host_hwnd, SW_HIDE);
                }
                return;
            }

            match visible_target_rect(target_hwnd) {
                Ok(Some(rect)) => {
                    if let Err(error) = self.present_target(rect) {
                        tracing::warn!(?error, "failed to update magnifier overlay");
                    }
                }
                Ok(None) => unsafe {
                    let _ = ShowWindow(self.host_hwnd, SW_HIDE);
                },
                Err(error) => {
                    tracing::warn!(?error, "target window became unavailable");
                    let _ = self.detach();
                }
            }
        }

        fn present_target(&mut self, rect: RECT) -> Result<()> {
            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;
            if width <= 0 || height <= 0 {
                unsafe {
                    let _ = ShowWindow(self.host_hwnd, SW_HIDE);
                }
                return Ok(());
            }

            unsafe {
                SetWindowPos(
                    self.host_hwnd,
                    Some(HWND_TOPMOST),
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

        fn cleanup(&mut self) -> Result<()> {
            unsafe {
                let _ = ShowWindow(self.host_hwnd, SW_HIDE);
                DestroyWindow(self.magnifier_hwnd)
                    .context("failed to destroy the magnifier control")?;
                DestroyWindow(self.host_hwnd)
                    .context("failed to destroy the magnifier host window")?;
            }

            Ok(())
        }

        fn update_shared_snapshot(
            &self,
            status: LensStatus,
            active_target: Option<WindowDescriptor>,
            active_preset: Option<VisualPreset>,
        ) {
            let summary = match status {
                LensStatus::Detached => {
                    "No window is attached. Refresh the window list and attach Greyscale Invert."
                        .to_string()
                }
                LensStatus::Attached => {
                    let target = active_target
                        .as_ref()
                        .map(|entry| entry.title.as_str())
                        .unwrap_or("the selected window");
                    format!("Greyscale Invert is attached to {target}.")
                }
                LensStatus::Suspended => {
                    if let Some(target) = active_target.as_ref() {
                        format!(
                            "Lens output is suspended while {} remains selected.",
                            target.title
                        )
                    } else {
                        "Lens output is suspended before any window is attached.".to_string()
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
            snapshot.summary = summary;
            snapshot.backend_label = "Windows Magnification backend".to_string();
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
            left.attachment_state
                .cmp(&right.attachment_state)
                .then_with(|| right.is_foreground.cmp(&left.is_foreground))
                .then_with(|| left.title.to_lowercase().cmp(&right.title.to_lowercase()))
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

    fn visible_target_rect(hwnd: HWND) -> Result<Option<RECT>> {
        unsafe {
            if !IsWindow(Some(hwnd)).as_bool()
                || !IsWindowVisible(hwnd).as_bool()
                || IsIconic(hwnd).as_bool()
            {
                return Ok(None);
            }
        }

        let foreground = unsafe { GetForegroundWindow() };
        if foreground.0.is_null() {
            return Ok(None);
        }

        let same_focus_family = unsafe {
            let target_root = GetAncestor(hwnd, GA_ROOTOWNER);
            let foreground_root = GetAncestor(foreground, GA_ROOTOWNER);
            target_root == foreground_root
        };
        if !same_focus_family {
            return Ok(None);
        }

        let mut rect = RECT::default();
        unsafe {
            GetWindowRect(hwnd, &mut rect).context("failed to read target window bounds")?;
        }

        Ok(Some(rect))
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
