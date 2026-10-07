$mingwBin = "C:\Users\ok\w64devkit\bin"
$rustBin = "C:\Users\ok\.rustup\toolchains\stable-x86_64-pc-windows-gnu\bin"

$env:Path = "$mingwBin;$rustBin;" + $env:Path

Write-Host "gcc version:"
& "$mingwBin\gcc.exe" --version | Select-Object -First 1

Write-Host "dlltool version:"
& "$mingwBin\dlltool.exe" --version | Select-Object -First 1

Write-Host "Running cargo test in src-tauri..."
Set-Location "F:\Tracking Dashboard\src-tauri"
& "$rustBin\cargo.exe" test -- --nocapture
