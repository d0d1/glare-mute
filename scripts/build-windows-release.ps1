[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-VsWherePath {
  $command = Get-Command vswhere.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $roots = @(
    ${env:ProgramFiles(x86)},
    $env:ProgramFiles
  ) | Where-Object { $_ }

  foreach ($root in $roots) {
    $candidate = Join-Path $root "Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "Could not find vswhere.exe. Install Visual Studio Build Tools 2022 with the Desktop development with C++ workload."
}

function Get-VcVarsPath([string] $vswherePath) {
  $vcvars = & $vswherePath `
    -latest `
    -products * `
    -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
    -find "VC\Auxiliary\Build\vcvars64.bat"

  if (-not $vcvars) {
    throw "Could not find vcvars64.bat. Install Visual Studio Build Tools 2022 with the Desktop development with C++ workload."
  }

  return $vcvars | Select-Object -First 1
}

$scriptRoot = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path -Parent $scriptRoot
$vswherePath = Get-VsWherePath
$vcvarsPath = Get-VcVarsPath -vswherePath $vswherePath

$cmd = @(
  "call `"$vcvarsPath`"",
  "cd /d `"$repoRoot`"",
  "corepack pnpm --filter @glaremute/desktop tauri:build"
) -join " && "

Write-Host "Using Visual Studio toolchain: $vcvarsPath"
Write-Host "Building Windows release artifacts from: $repoRoot"

& cmd.exe /d /s /c $cmd

if ($LASTEXITCODE -ne 0) {
  throw "Windows release build failed with exit code $LASTEXITCODE."
}
