$libs = Get-ChildItem -Path "C:\Program Files*", "C:\Windows*" -Filter "kernel32.lib" -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
if ($libs) {
    Write-Host "Found kernel32.lib:"
    $libs | ForEach-Object { Write-Host $_ }
} else {
    Write-Host "kernel32.lib not found in Program Files or Windows"
}
