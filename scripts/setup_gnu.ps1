$gnuBin = "C:\Users\ok\.rustup\toolchains\stable-x86_64-pc-windows-gnu\bin"
Set-Content -Path "C:\Users\ok\AppData\Roaming\npm\cargo.cmd" -Value "@`"$gnuBin\cargo.exe`" %*"
Set-Content -Path "C:\Users\ok\AppData\Roaming\npm\rustc.cmd" -Value "@`"$gnuBin\rustc.exe`" %*"
Set-Content -Path "C:\Users\ok\AppData\Roaming\npm\cargo.ps1" -Value "& `"$gnuBin\cargo.exe`" `$args"
Set-Content -Path "C:\Users\ok\AppData\Roaming\npm\rustc.ps1" -Value "& `"$gnuBin\rustc.exe`" `$args"

& "$gnuBin\cargo.exe" --version
& "$gnuBin\rustc.exe" --version
