# Release Workflow

## Beta channel

The first beta channel should stay on GitHub Releases.

That keeps the release path low-overhead while Glare mute is still changing quickly and the Windows installer shape is still being validated.

## What is already prepared

- `.github/workflows/release.yml` builds the Windows bundle on GitHub-hosted runners and can publish either:
  - unsigned release assets when SignPath is not configured yet
  - signed release assets when the SignPath configuration is present
- any `v*` tag triggers the same build and opens a draft GitHub Release.
- the workflow publishes these Windows assets:
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

If those values are missing, the workflow now skips the SignPath branch and publishes an unsigned draft release instead of failing.

## Manual artifact run

Use the `Release` workflow through `workflow_dispatch` when you want GitHub-built signed artifacts without publishing a tag yet.

That gives you downloadable signed artifacts from Actions while keeping GitHub Releases untouched.

## Draft beta release

Do not create or publish a release tag until the `main` branch CI is green for the exact commit you intend to release.
`main` CI now includes a Windows release-bundle validation job, so release artifact breakage should be caught before tagging instead of only after a release tag is pushed.
Treat release-workflow changes as production code: validate everything locally that can be validated before push, then confirm the real GitHub run before trusting the release path.

When the repo is ready for a draft beta, push a version tag that starts with `v`, for example:

```bash
git tag v0.1.2
git push origin v0.1.2
```

That will:

- build the portable Windows executable and installers on GitHub Actions
- upload the unsigned workflow artifacts
- if SignPath is configured:
  - submit signing requests for the portable EXE, NSIS installer, and MSI
  - wait for signed outputs to complete
  - create a draft GitHub Release with the signed assets attached
- if SignPath is not configured:
  - create a draft GitHub Release with the unsigned assets attached

## Local verification before tagging

Local verification is not a substitute for green GitHub CI. Treat local checks as a preflight, then confirm the matching `main` CI run is green before tagging.
For workflow changes, this means validating both the repo checks and the workflow logic branch you expect to take, then verifying the matching GitHub run after push.

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
