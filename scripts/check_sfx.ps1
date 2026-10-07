$items = Get-ChildItem -Path "C:\Users\ok\" -Filter "*w64devkit*"
$items | ForEach-Object { Write-Host $_.FullName $_.Mode }
