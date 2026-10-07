[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "C:\Users\ok\.rustup\rustup-init.exe"
Write-Host "Downloaded rustup-init:" (Test-Path "C:\Users\ok\.rustup\rustup-init.exe")
