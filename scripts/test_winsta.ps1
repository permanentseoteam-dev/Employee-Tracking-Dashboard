Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;

public class ScreenCap {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenWindowStation(string name, bool inherit, uint access);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessWindowStation(IntPtr hWinSta);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string name, uint flags, bool inherit, uint access);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetDC(IntPtr hwnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, uint dwRop);
}
"@

$winsta = [ScreenCap]::OpenWindowStation("WinSta0", $false, 0x0000037F)
Write-Host "OpenWindowStation WinSta0:" $winsta
if ($winsta -ne [IntPtr]::Zero) {
    $ok1 = [ScreenCap]::SetProcessWindowStation($winsta)
    Write-Host "SetProcessWindowStation:" $ok1
}

$desk = [ScreenCap]::OpenDesktop("Default", 0, $false, 0x000001FF)
Write-Host "OpenDesktop Default:" $desk
if ($desk -ne [IntPtr]::Zero) {
    $ok2 = [ScreenCap]::SetThreadDesktop($desk)
    Write-Host "SetThreadDesktop:" $ok2
}

try {
    Add-Type -AssemblyName System.Windows.Forms
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $bmp = New-Object System.Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
    $bmp.Save("F:\TrackingDashboard\scripts\test_screen_real.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "SUCCESS! Captured real screen size: $($screen.Bounds.Width)x$($screen.Bounds.Height)"
} catch {
    Write-Host "Failed CopyFromScreen:" $_.Exception.Message
}
