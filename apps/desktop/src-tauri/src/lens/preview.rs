use std::sync::Mutex;

use anyhow::{Result, bail};
use glare_mute_core::{LensSnapshot, LensStatus, ProfileRule, WindowDescriptor};

pub(super) struct LensControllerImpl {
    snapshot: Mutex<LensSnapshot>,
}

impl LensControllerImpl {
    pub(super) fn new(initially_suspended: bool, _apply_to_related_windows: bool) -> Result<Self> {
        Ok(Self {
            snapshot: Mutex::new(LensSnapshot {
                status: if initially_suspended {
                    LensStatus::Suspended
                } else {
                    LensStatus::Detached
                },
                covered_targets: Vec::new(),
                profile_snapshots: Vec::new(),
                summary: "Native window effects only run in the Windows desktop shell.".to_string(),
                backend_label: "Preview backend".to_string(),
            }),
        })
    }

    pub(super) fn set_profiles(&self, _profiles: Vec<ProfileRule>) -> Result<LensSnapshot> {
        bail!("Native window effects only run in the Windows desktop shell.")
    }

    pub(super) fn list_windows(&self) -> Result<Vec<WindowDescriptor>> {
        Ok(Vec::new())
    }

    pub(super) fn set_apply_to_related_windows(&self, _enabled: bool) -> Result<LensSnapshot> {
        Ok(self
            .snapshot
            .lock()
            .expect("preview lens lock poisoned")
            .clone())
    }

    #[allow(dead_code)]
    pub(super) fn set_suspended(&self, suspended: bool) -> Result<LensSnapshot> {
        let mut snapshot = self.snapshot.lock().expect("preview lens lock poisoned");
        snapshot.status = if suspended {
            LensStatus::Suspended
        } else {
            LensStatus::Detached
        };
        Ok(snapshot.clone())
    }

    pub(super) fn snapshot(&self) -> Result<LensSnapshot> {
        Ok(self
            .snapshot
            .lock()
            .expect("preview lens lock poisoned")
            .clone())
    }
}
