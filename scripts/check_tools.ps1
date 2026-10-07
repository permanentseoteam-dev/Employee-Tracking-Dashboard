$vswhere = Get-ChildItem -Path "C:\Program Files*" -Filter "vswhere.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($vswhere) {
    Write-Host "Found vswhere: $($vswhere.FullName)"
    & $vswhere.FullName -latest -format json
} else {
    Write-Host "vswhere not found"
}

$cl = Get-Command cl.exe -ErrorAction SilentlyContinue
Write-Host "cl.exe: $cl"
$link = Get-Command link.exe -ErrorAction SilentlyContinue
Write-Host "link.exe: $link"
$gcc = Get-Command gcc.exe -ErrorAction SilentlyContinue
Write-Host "gcc.exe: $gcc"
$clang = Get-Command clang.exe -ErrorAction SilentlyContinue
Write-Host "clang.exe: $clang"
