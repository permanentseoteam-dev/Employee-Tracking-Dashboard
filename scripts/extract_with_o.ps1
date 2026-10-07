Start-Process -FilePath "C:\Users\ok\w64devkit-sfx.exe" -ArgumentList "-oC:\Users\ok", "-y" -Wait -NoNewWindow
$fileCount = (Get-ChildItem -Path "C:\Users\ok\w64devkit" -Recurse -File).Count
Write-Host "Total files extracted: $fileCount"
Get-ChildItem "C:\Users\ok\w64devkit\bin" | Select-Object -First 5 | ForEach-Object { Write-Host $_.Name }
