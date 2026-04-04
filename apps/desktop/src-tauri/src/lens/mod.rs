use anyhow::Result;
use glare_mute_core::{LensSnapshot, ProfileRule, WindowDescriptor};

#[cfg(not(target_os = "windows"))]
mod preview;
#[cfg(target_os = "windows")]
mod windows;

#[cfg(not(target_os = "windows"))]
use preview::LensControllerImpl;
#[cfg(target_os = "windows")]
use windows::LensControllerImpl;

pub struct LensController {
    inner: LensControllerImpl,
}

impl LensController {
    pub fn new(initially_suspended: bool, apply_to_related_windows: bool) -> Result<Self> {
        Ok(Self {
            inner: LensControllerImpl::new(initially_suspended, apply_to_related_windows)?,
        })
    }

    pub fn set_profiles(&self, profiles: Vec<ProfileRule>) -> Result<LensSnapshot> {
        self.inner.set_profiles(profiles)
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
