Get-Process -Name "*w64devkit*" -ErrorAction SilentlyContinue
Get-ChildItem -Path "C:\Users\ok\w64devkit" -Recurse | Select-Object -First 20 | ForEach-Object { Write-Host $_.FullName }
