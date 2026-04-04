use anyhow::{Result, bail};
use glare_mute_core::VisualPreset;
use windows::Win32::UI::Magnification::{MAGCOLOREFFECT, MAGTRANSFORM};

pub(super) fn identity_transform() -> MAGTRANSFORM {
    let mut matrix = MAGTRANSFORM::default();
    matrix.v[0] = 1.0;
    matrix.v[4] = 1.0;
    matrix.v[8] = 1.0;
    matrix
}

pub(super) fn effect_for_preset(preset: VisualPreset) -> Result<MAGCOLOREFFECT> {
    match preset {
        VisualPreset::Invert => Ok(invert_effect()),
        VisualPreset::GreyscaleInvert => Ok(greyscale_invert_effect()),
        VisualPreset::WarmDim => {
            bail!("Warm Dim is not implemented in the native Windows path right now.")
        }
    }
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
            -1.0, 0.0, 0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 0.0, 1.0,
        ],
    }
}
