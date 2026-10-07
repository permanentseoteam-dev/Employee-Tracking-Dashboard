$tools = Get-ChildItem -Path "C:\Program Files\Git" -Filter "*dlltool*" -Recurse -ErrorAction SilentlyContinue
if ($tools) {
    Write-Host "Found dlltool:"
    $tools | ForEach-Object { Write-Host $_.FullName }
} else {
    Write-Host "dlltool not found in Git"
}
