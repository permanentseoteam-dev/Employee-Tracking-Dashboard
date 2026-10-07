Get-ChildItem "C:\Users\ok\.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\lib\*.a" | Select-Object -First 10 | ForEach-Object { Write-Host $_.Name }
