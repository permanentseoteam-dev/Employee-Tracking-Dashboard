$gccLibs = Get-ChildItem -Path "C:\Users\ok\w64devkit\lib" -Filter "*libgcc.a" -Recurse
foreach ($lib in $gccLibs) {
    Write-Host "Found libgcc.a at: " $lib.FullName
    $ehPath = Join-Path $lib.DirectoryName "libgcc_eh.a"
    if (-not (Test-Path $ehPath)) {
        Copy-Item $lib.FullName $ehPath -Force
        Write-Host "Created libgcc_eh.a at: " $ehPath
    }
}
$topEh = "C:\Users\ok\w64devkit\lib\libgcc_eh.a"
if (-not (Test-Path $topEh) -and $gccLibs.Count -gt 0) {
    Copy-Item $gccLibs[0].FullName $topEh -Force
    Write-Host "Created top-level libgcc_eh.a at: " $topEh
}
