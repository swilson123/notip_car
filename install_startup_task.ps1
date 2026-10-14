[CmdletBinding()]
param(
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$taskName = 'WhiteRabbitCar'

if ($Uninstall) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed scheduled task '$taskName' (if it was installed)."
    exit 0
}

$currentPrincipal = New-Object Security.Principal.WindowsPrincipal(
    [Security.Principal.WindowsIdentity]::GetCurrent()
)
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator privileges are required to register an at-startup task. Run this script from an elevated PowerShell session under the account that should run White Rabbit.'
}

$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $projectDirectory 'white_rabbit.js'
$node = Get-Command node.exe -ErrorAction Stop
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name

$action = New-ScheduledTaskAction `
    -Execute $node.Source `
    -Argument ('"{0}"' -f $scriptPath) `
    -WorkingDirectory $projectDirectory
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal `
    -UserId $user `
    -LogonType S4U `
    -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description 'Starts the White Rabbit car MAVLink bridge when Windows starts.' `
    -Force | Out-Null

Write-Host "Installed '$taskName' to start at boot as $user."
Write-Host "To start it now: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "To remove it: .\install_startup_task.ps1 -Uninstall"
