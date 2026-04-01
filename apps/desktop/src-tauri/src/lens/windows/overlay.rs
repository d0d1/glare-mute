use anyhow::{Context, Result};
use glare_mute_core::VisualPreset;
use windows::Win32::Foundation::COLORREF;
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::Magnification::{
    MagSetColorEffect, MagSetWindowSource, MagSetWindowTransform, WC_MAGNIFIER,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DestroyWindow, HMENU, LAYERED_WINDOW_ATTRIBUTES_FLAGS, LWA_ALPHA,
    SET_WINDOW_POS_FLAGS, SW_HIDE, SW_SHOWNOACTIVATE, SWP_NOACTIVATE, SWP_NOOWNERZORDER,
    SWP_NOZORDER, SetLayeredWindowAttributes, SetWindowPos, ShowWindow, WINDOW_EX_STYLE,
    WINDOW_STYLE, WS_CHILD, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
    WS_POPUP, WS_VISIBLE,
};
use windows::core::w;

use super::effects::{effect_for_preset, identity_transform};
use super::windowing::{HOST_CLASS_NAME, PresentationTarget, ensure_bool, parse_window_id};

pub(super) struct OverlaySurface {
    pub target_window_id: String,
    pub target_hwnd: windows::Win32::Foundation::HWND,
    pub host_hwnd: windows::Win32::Foundation::HWND,
    pub magnifier_hwnd: windows::Win32::Foundation::HWND,
}

impl OverlaySurface {
    pub(super) fn create(target_window_id: &str, preset: VisualPreset) -> Result<Self> {
        let instance = unsafe {
            GetModuleHandleW(None).context("failed to resolve module handle for host window")?
        };
        let host_hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(
                    WS_EX_LAYERED.0 | WS_EX_TRANSPARENT.0 | WS_EX_TOOLWINDOW.0 | WS_EX_NOACTIVATE.0,
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
            target_window_id: target_window_id.to_string(),
            target_hwnd: parse_window_id(target_window_id)?,
            host_hwnd,
            magnifier_hwnd,
        };
        surface.set_effect(preset)?;
        surface.hide();
        Ok(surface)
    }

    pub(super) fn set_effect(&mut self, preset: VisualPreset) -> Result<()> {
        let mut effect = effect_for_preset(preset)?;
        unsafe {
            ensure_bool(
                MagSetColorEffect(self.magnifier_hwnd, &mut effect),
                "failed to apply the selected color effect",
            )?;
        }

        Ok(())
    }

    pub(super) fn present(&mut self, target: PresentationTarget) -> Result<()> {
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

    pub(super) fn hide(&self) {
        unsafe {
            let _ = ShowWindow(self.host_hwnd, SW_HIDE);
        }
    }

    pub(super) fn destroy(self) -> Result<()> {
        unsafe {
            let _ = ShowWindow(self.host_hwnd, SW_HIDE);
            DestroyWindow(self.magnifier_hwnd)
                .context("failed to destroy the magnifier control")?;
            DestroyWindow(self.host_hwnd).context("failed to destroy the magnifier host window")?;
        }

        Ok(())
    }
}
