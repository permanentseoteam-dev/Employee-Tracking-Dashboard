$releases = Invoke-RestMethod -Uri "https://api.github.com/repos/skeeto/w64devkit/releases" -Headers @{"User-Agent"="PowerShell"}
foreach ($rel in $releases) {
    foreach ($asset in $rel.assets) {
        if ($asset.name -like "*.zip") {
            Write-Host "Found zip:" $asset.name $asset.browser_download_url
            return
        }
    }
}
