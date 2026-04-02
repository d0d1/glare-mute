# Release Workflow

## Beta channel

The first beta channel should stay on GitHub Releases.

That keeps the release path low-overhead while Glare mute is still changing quickly and the Windows installer shape is still being validated.

## What is already prepared

- `.github/workflows/release.yml` can build the Windows bundle on demand
- any `v*` tag triggers the same build and opens a draft GitHub Release
- the workflow uploads the portable Windows build and both installer outputs:
  - `target/release/glare-mute-portable.exe`
  - `target/release/bundle/msi/*.msi`
  - `target/release/bundle/nsis/*.exe`

## Manual artifact run

Use the `Release` workflow through `workflow_dispatch` when you want CI-built installers without publishing anything yet.

That gives you downloadable bundle artifacts from Actions while keeping GitHub Releases untouched.

## Draft beta release

When the repo is ready for a draft beta, push a version tag that starts with `v`, for example:

```bash
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

That will:

- build the portable Windows executable and installers on GitHub Actions
- upload them as workflow artifacts
- create a draft GitHub Release with the same assets attached

## Local verification before tagging

From Windows:

```powershell
cd C:\Users\dbhul\code\glare-mute
corepack pnpm install
corepack pnpm --filter @glaremute/desktop tauri:build
```

The built outputs should appear under:

- `target\release\glare-mute-desktop.exe`
- `target\release\bundle\msi`
- `target\release\bundle\nsis`

For release distribution, publish the direct executable as `glare-mute-portable.exe` so it is clearly distinguished from the installer builds.
