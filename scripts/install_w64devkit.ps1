$res = Invoke-RestMethod -Uri "https://api.github.com/repos/skeeto/w64devkit/releases/latest" -Headers @{"User-Agent"="PowerShell"}
$asset = $res.assets | Where-Object { $_.name -like "*zip*" } | Select-Object -First 1
Write-Host "Found release: " $res.tag_name "asset:" $asset.browser_download_url
if ($asset) {
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile "C:\Users\ok\w64devkit.zip"
    Write-Host "Downloaded: " (Test-Path "C:\Users\ok\w64devkit.zip")
    Expand-Archive -Path "C:\Users\ok\w64devkit.zip" -DestinationPath "C:\Users\ok\" -Force
    Write-Host "w64devkit extracted to C:\Users\ok\w64devkit"
}
