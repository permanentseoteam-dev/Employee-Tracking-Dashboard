$url = "https://github.com/skeeto/w64devkit/releases/download/v2.10.0/w64devkit-x64-2.10.0.7z.exe"
$dest = "C:\Users\ok\w64devkit-sfx.exe"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Write-Host "Downloading w64devkit SFX..."
Invoke-WebRequest -Uri $url -OutFile $dest
Write-Host "Downloaded: " (Test-Path $dest)
if (Test-Path $dest) {
    Write-Host "Extracting to C:\Users\ok..."
    Set-Location "C:\Users\ok"
    & $dest -y
    Write-Host "Extracted! Checking bin:"
    Get-ChildItem "C:\Users\ok\w64devkit\bin" | Select-Object -First 5
}
