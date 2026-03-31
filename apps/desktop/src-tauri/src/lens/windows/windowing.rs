use std::ffi::c_void;
use std::mem::size_of;

use anyhow::{Context, Result, anyhow};
use glare_mute_core::{WindowAttachmentState, WindowBounds, WindowDescriptor};
use windows::Win32::Foundation::{CloseHandle, GetLastError, HWND, LPARAM, LRESULT, RECT};
use windows::Win32::Graphics::Dwm::{DWMWA_CLOAKED, DwmGetWindowAttribute};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::{
    GetCurrentProcessId, OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
    QueryFullProcessImageNameW,
};
use windows::Win32::UI::WindowsAndMessaging::{
    DefWindowProcW, DispatchMessageW, EnumWindows, GET_WINDOW_CMD, GW_HWNDPREV, GWL_EXSTYLE,
    GetClassNameW, GetForegroundWindow, GetWindow, GetWindowLongW, GetWindowRect,
    GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow,
    IsWindowVisible, MSG, PM_REMOVE, PeekMessageW, RegisterClassW, TranslateMessage, WNDCLASSW,
    WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
};
use windows::core::{BOOL, Error as WindowsError, PCWSTR, PWSTR, w};

pub(super) const HOST_CLASS_NAME: PCWSTR = w!("GlareMuteMagnifierHost");

pub(super) struct PresentationTarget {
    pub rect: RECT,
    pub insert_after: HWND,
}

pub(super) fn enumerate_attachable_windows() -> Result<Vec<WindowDescriptor>> {
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

pub(super) fn describe_window(hwnd: HWND) -> Result<Option<WindowDescriptor>> {
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

pub(super) fn presentation_target(
    hwnd: HWND,
    host_hwnd: HWND,
) -> Result<Option<PresentationTarget>> {
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

pub(super) fn parse_window_id(window_id: &str) -> Result<HWND> {
    let trimmed = window_id.trim();
    let raw = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
        .unwrap_or(trimmed);
    let value = u64::from_str_radix(raw, 16)
        .with_context(|| format!("failed to parse window id {window_id}"))?;
    Ok(HWND(value as usize as *mut c_void))
}

pub(super) fn register_host_window_class() -> Result<()> {
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

pub(super) fn ensure_bool(result: BOOL, context: &str) -> Result<()> {
    if result.as_bool() {
        Ok(())
    } else {
        Err(anyhow!("{context}: {}", WindowsError::from_win32()))
    }
}

pub(super) fn pump_messages() -> Result<bool> {
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

unsafe extern "system" fn enum_windows_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let windows = unsafe { &mut *(lparam.0 as *mut Vec<WindowDescriptor>) };

    if let Ok(Some(descriptor)) = describe_window(hwnd) {
        windows.push(descriptor);
    }

    BOOL(1)
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
            windows::Win32::UI::WindowsAndMessaging::HWND_TOPMOST
        } else {
            windows::Win32::UI::WindowsAndMessaging::HWND_TOP
        });
    }

    if !target_is_topmost && is_topmost_window(above_target) {
        return Ok(windows::Win32::UI::WindowsAndMessaging::HWND_TOP);
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
            PWSTR(buffer.as_mut_ptr()),
            &mut size,
        )
        .context("failed to resolve the target executable path")?;
        let _ = CloseHandle(handle);
    }

    Ok(String::from_utf16_lossy(&buffer[..size as usize]))
}

fn format_window_id(hwnd: HWND) -> String {
    format!("0x{:X}", hwnd.0 as usize)
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

extern "system" fn host_window_proc(
    hwnd: HWND,
    message: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    unsafe { DefWindowProcW(hwnd, message, wparam, lparam) }
}
