$w64bin = "C:\Users\ok\w64devkit\bin"
$rustbin = "C:\Users\ok\.rustup\toolchains\stable-x86_64-pc-windows-gnu\bin"

$env:Path = "$w64bin;$rustbin;" + $env:Path

Write-Host "Running cargo test in src-tauri with -j 1 to prevent file locking collisions..."
Set-Location "F:\Tracking Dashboard\src-tauri"
cargo.cmd test -j 1 -- --nocapture
