# Release Workflow

## Beta channel

The first beta channel should stay on GitHub Releases.

That keeps the release path low-overhead while Glare mute is still changing quickly and the Windows installer shape is still being validated.

## What is already prepared

- `.github/workflows/release.yml` builds the Windows bundle on GitHub-hosted runners and submits the release artifacts to SignPath for signing.
- any `v*` tag triggers the same build and opens a draft GitHub Release.
- the workflow publishes only signed assets:
  - `glare-mute-portable.exe`
  - `Glare.mute_<version>_x64-setup.exe`
  - `Glare.mute_<version>_x64_en-US.msi`

## Manual setup still required

Before the workflow can sign anything, complete the SignPath Foundation and GitHub setup manually:

- apply for the project with SignPath Foundation
- create the SignPath organization/project/signing policy/artifact configurations
- install the SignPath GitHub App if SignPath requires repository policy verification
- create the repository secret:
  - `SIGNPATH_API_TOKEN`
- create the repository variables:
  - `SIGNPATH_ORGANIZATION_ID`
  - `SIGNPATH_PROJECT_SLUG`
  - `SIGNPATH_SIGNING_POLICY_SLUG`
  - `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG_PORTABLE`
  - `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG_SETUP`
  - `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG_MSI`

The workflow now fails fast with a clear error if any of those values are missing.

## Manual artifact run

Use the `Release` workflow through `workflow_dispatch` when you want GitHub-built signed artifacts without publishing a tag yet.

That gives you downloadable signed artifacts from Actions while keeping GitHub Releases untouched.

## Draft beta release

When the repo is ready for a draft beta, push a version tag that starts with `v`, for example:

```bash
git tag v0.1.1
git push origin v0.1.1
```

That will:

- build the portable Windows executable and installers on GitHub Actions
- upload the unsigned workflow artifacts required by SignPath
- submit signing requests for the portable EXE, NSIS installer, and MSI
- wait for signed outputs to complete
- create a draft GitHub Release with the signed assets attached

## Local verification before tagging

From Windows:

```powershell
cd C:\Users\dbhul\code\glare-mute
corepack pnpm install
corepack pnpm build:windows
```

The built outputs should appear under:

- `target\release\glare-mute-desktop.exe`
- `target\release\bundle\msi`
- `target\release\bundle\nsis`

For release distribution, publish the direct executable as `glare-mute-portable.exe` so it is clearly distinguished from the installer builds.

## Windows prerequisites

The canonical local Windows release path depends on the Microsoft C++ toolchain.

- install Visual Studio Build Tools 2022
- include the `Desktop development with C++` workload
- run `corepack pnpm build:windows`

`build:windows` uses `vswhere.exe` to discover the installed toolchain, loads `vcvars64.bat`, and then runs the Tauri production build. The repo does not rely on ad hoc temp wrappers or a manually opened Visual Studio developer shell.
