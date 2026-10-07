$res = Invoke-RestMethod -Uri "https://api.github.com/repos/skeeto/w64devkit/releases/latest" -Headers @{"User-Agent"="PowerShell"}
$res.assets | ForEach-Object { Write-Host $_.name $_.browser_download_url }
