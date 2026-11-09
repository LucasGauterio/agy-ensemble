[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$Command = "setup",
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$ArgsList
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$AllArgs = @()
if ($Command) {
    $AllArgs += $Command
}
if ($ArgsList) {
    $AllArgs += $ArgsList
}

$BunExe = $null
if (Get-Command bun -ErrorAction SilentlyContinue) {
    $BunExe = "bun"
} elseif (Test-Path "$ScriptDir\node_modules\.bin\bun.cmd") {
    $BunExe = "$ScriptDir\node_modules\.bin\bun.cmd"
} elseif (Test-Path "$env:USERPROFILE\.bun\bin\bun.exe") {
    $BunExe = "$env:USERPROFILE\.bun\bin\bun.exe"
}

if ($BunExe) {
    & $BunExe run "$ScriptDir\scripts\runner.ts" @AllArgs
    exit $LASTEXITCODE
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
    & node "$ScriptDir\scripts\runner.ts" @AllArgs
    exit $LASTEXITCODE
} else {
    Write-Error "[agy-ensemble] Error: Neither Bun nor Node.js was found on this system.`nPlease install Bun (https://bun.sh) or Node.js (https://nodejs.org)."
    exit 1
}
