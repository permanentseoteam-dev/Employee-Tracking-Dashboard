$procs = Get-Process | Where-Object { $_.ProcessName -like "*w64*" -or $_.ProcessName -like "*7z*" }
if ($procs) {
    Write-Host "Extracting process active:"
    $procs | ForEach-Object { Write-Host $_.ProcessName }
} else {
    Write-Host "No active extraction process"
}
$fileCount = (Get-ChildItem -Path "C:\Users\ok\w64devkit" -Recurse -File).Count
Write-Host "Total files extracted so far: $fileCount"
