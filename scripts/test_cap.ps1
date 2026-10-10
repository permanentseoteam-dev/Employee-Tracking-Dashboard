try {
    Add-Type -AssemblyName System.Drawing, System.Windows.Forms
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    Write-Host "PrimaryScreen: $screen"
    if ($screen) {
        Write-Host "Bounds: $($screen.Bounds.Width) x $($screen.Bounds.Height)"
        $bmp = New-Object System.Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
        $bmp.Save("F:\TrackingDashboard\scripts\test_screen.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
        $g.Dispose()
        $bmp.Dispose()
        Write-Host "Successfully saved test_screen.jpg"
    } else {
        Write-Host "PrimaryScreen is NULL!"
    }
} catch {
    Write-Host "Exception: $($_.Exception.Message)"
}
