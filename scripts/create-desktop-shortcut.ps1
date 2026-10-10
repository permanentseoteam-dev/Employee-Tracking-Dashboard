<#
.SYNOPSIS
Creates or updates Windows desktop shortcuts for Employee Tracking App with custom high-resolution icon.
#>

$desktop = [Environment]::GetFolderPath("Desktop")
$workspace = "F:\TrackingDashboard"
$iconPath = Join-Path $workspace "src-tauri\icons\icon.ico"
$desktopExe = Join-Path $workspace "release\desktop\tracking-dashboard-app.exe"

$wshShell = New-Object -ComObject WScript.Shell

# 1. Desktop Application Shortcut
if (Test-Path $desktopExe) {
    $shortcutPath = Join-Path $desktop "Employee Tracking App.lnk"
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $desktopExe
    $shortcut.WorkingDirectory = Split-Path $desktopExe
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.Description = "Employee Tracking App - Workforce Telemetry Desktop"
    $shortcut.Save()
    Write-Host "Created Desktop Shortcut: $shortcutPath"
}

# 2. Localhost Web App Shortcut (opens in Chrome/Edge app window mode if available, or default browser)
$webShortcutPath = Join-Path $desktop "Employee Tracking Dashboard (Localhost).lnk"
$webShortcut = $wshShell.CreateShortcut($webShortcutPath)

$chromePath = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$edgePath = "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"

if (Test-Path $chromePath) {
    $webShortcut.TargetPath = $chromePath
    $webShortcut.Arguments = "--app=http://localhost:1420/"
} elseif (Test-Path $edgePath) {
    $webShortcut.TargetPath = $edgePath
    $webShortcut.Arguments = "--app=http://localhost:1420/"
} else {
    $webShortcut.TargetPath = "http://localhost:1420/"
}

$webShortcut.IconLocation = "$iconPath,0"
$webShortcut.Description = "Employee Tracking Dashboard Web Client"
$webShortcut.Save()
Write-Host "Created Web Shortcut: $webShortcutPath"

# Refresh icon cache
[System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms") | Out-Null
$signature = @'
[DllImport("shell32.dll")]
public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
'@
$type = Add-Type -MemberDefinition $signature -Name "ShellNotify" -Namespace "Win32" -PassThru
$type::SHChangeNotify(0x08000000, 0x0000, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Host "Windows Shell notified. Desktop icons updated."
