use glare_mute_core::{CapabilityDescriptor, CapabilityStatus, PlatformSummary};

pub fn probe_platform(webview_version: Option<String>) -> PlatformSummary {
    #[cfg(target_os = "windows")]
    {
        windows::probe(webview_version)
    }

    #[cfg(not(target_os = "windows"))]
    {
        preview::probe(webview_version)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_has_capabilities() {
        let snapshot = probe_platform(None);

        assert!(!snapshot.capabilities.is_empty());
        assert!(!snapshot.backend_id.is_empty());
    }
}

#[cfg(not(target_os = "windows"))]
mod preview {
    use super::*;

    pub fn probe(webview_version: Option<String>) -> PlatformSummary {
        PlatformSummary {
            os: std::env::consts::OS.to_string(),
            target: format!("{}-{}", std::env::consts::ARCH, std::env::consts::OS),
            backend_id: "browser-preview".to_string(),
            backend_label: "Browser Preview".to_string(),
            webview_version,
            capabilities: vec![
                capability(
                    "windowPicker",
                    "Window picker",
                    CapabilityStatus::Unsupported,
                    "Window attachment only runs on Windows builds.",
                ),
                capability(
                    "tintBackend",
                    "Tint backend",
                    CapabilityStatus::Unsupported,
                    "The preview shell does not attach overlays to native windows.",
                ),
                capability(
                    "magnificationBackend",
                    "Magnification transform",
                    CapabilityStatus::Unsupported,
                    "Magnification API experiments require Windows.",
                ),
                capability(
                    "captureBackend",
                    "Graphics Capture transform",
                    CapabilityStatus::Unsupported,
                    "Capture-based transforms are disabled outside Windows.",
                ),
                capability(
                    "popupTracking",
                    "Popup tracking",
                    CapabilityStatus::Unsupported,
                    "Popup coverage can only be diagnosed against native HWND trees.",
                ),
            ],
        }
    }
}

#[cfg(target_os = "windows")]
mod windows {
    use super::*;

    pub fn probe(webview_version: Option<String>) -> PlatformSummary {
        PlatformSummary {
            os: "windows".to_string(),
            target: format!("{}-windows", std::env::consts::ARCH),
            backend_id: "windows-shell".to_string(),
            backend_label: "Windows desktop shell".to_string(),
            webview_version,
            capabilities: vec![
                capability(
                    "windowPicker",
                    "Window picker",
                    CapabilityStatus::Available,
                    "The Windows shell can enumerate visible top-level windows for explicit attachment.",
                ),
                capability(
                    "tintBackend",
                    "Tint backend",
                    CapabilityStatus::Planned,
                    "Tint presets stay in the contract, but the first native slice ships the transform path first.",
                ),
                capability(
                    "magnificationBackend",
                    "Magnification transform",
                    CapabilityStatus::Available,
                    "Greyscale Invert runs through the Magnification API for the first Windows test slice.",
                ),
                capability(
                    "captureBackend",
                    "Graphics Capture transform",
                    CapabilityStatus::Planned,
                    "Capture plus shader remains a first-class fallback for invert-style modes.",
                ),
                capability(
                    "popupTracking",
                    "Popup tracking",
                    CapabilityStatus::Planned,
                    "Main-window coverage is the release bar; popup tracking follows after the shell hardens.",
                ),
            ],
        }
    }
}

fn capability(
    id: &str,
    label: &str,
    status: CapabilityStatus,
    summary: &str,
) -> CapabilityDescriptor {
    CapabilityDescriptor {
        id: id.to_string(),
        label: label.to_string(),
        status,
        summary: summary.to_string(),
    }
}
