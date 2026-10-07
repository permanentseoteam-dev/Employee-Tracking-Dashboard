@echo off
setlocal enabledelayedexpansion
title WorkPulse Agent — Automated Installer

echo ============================================================
echo      WorkPulse Desktop Agent — Automated Installer
echo ============================================================
echo.

:: 1. Define Target Directory in Local AppData (requires no special admin elevation)
set "INSTALL_DIR=%LOCALAPPDATA%\WorkPulseAgent"
set "TASK_NAME=WorkPulseDesktopAgent"

echo [*] Target Directory: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: 2. Copy Agent files
echo [*] Copying agent binaries and assets...
copy /Y "%~dp0agent.py" "%INSTALL_DIR%\" >nul 2>&1
copy /Y "%~dp0requirements.txt" "%INSTALL_DIR%\" >nul 2>&1
if exist "%~dp0WorkPulseAgent.exe" copy /Y "%~dp0WorkPulseAgent.exe" "%INSTALL_DIR%\" >nul 2>&1
if exist "%~dp0dist\WorkPulseAgent\WorkPulseAgent.exe" copy /Y "%~dp0dist\WorkPulseAgent\WorkPulseAgent.exe" "%INSTALL_DIR%\" >nul 2>&1

:: 3. Configure Employee Code if config doesn't exist
if not exist "%INSTALL_DIR%\config.json" (
    echo.
    set /p EMP_CODE="Enter Employee Code for this computer (e.g. EMP001, EMP002): "
    set /p SRV_URL="Enter Server URL [Press Enter for http://127.0.0.1:8000]: "
    if "!SRV_URL!"=="" set "SRV_URL=http://127.0.0.1:8000"

    (
        echo {
        echo   "server_url": "!SRV_URL!",
        echo   "employee_code": "!EMP_CODE!",
        echo   "sync_interval_seconds": 60,
        echo   "screenshot_interval_seconds": 600,
        echo   "screenshot_quality": 65
        echo }
    ) > "%INSTALL_DIR%\config.json"
    echo [*] Generated config.json for !EMP_CODE!
) else (
    echo [*] Existing config.json detected. Keeping current settings.
)

:: 4. Create Silent Background Launcher (VBS script to run without showing a command window)
set "RUN_VBS=%INSTALL_DIR%\run_silent.vbs"
if exist "%INSTALL_DIR%\WorkPulseAgent.exe" (
    set "EXEC_CMD=""%INSTALL_DIR%\WorkPulseAgent.exe"""
) else (
    :: Fallback to pythonw.exe (windowless python) or python
    set "EXEC_CMD="pythonw.exe ""%INSTALL_DIR%\agent.py""""
)

echo Set WshShell = CreateObject("WScript.Shell") > "%RUN_VBS%"
echo WshShell.CurrentDirectory = "%INSTALL_DIR%" >> "%RUN_VBS%"
echo WshShell.Run "%EXEC_CMD%", 0, False >> "%RUN_VBS%"

:: 5. Register with Windows Task Scheduler (Runs automatically at user logon)
echo [*] Registering auto-start task with Windows Task Scheduler...
schtasks /create /tn "%TASK_NAME%" /tr "wscript.exe \"%RUN_VBS%\"" /sc onlogon /f >nul 2>&1

:: 6. Also add to Windows Startup shortcut as reliable secondary fallback
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy /Y "%RUN_VBS%" "%STARTUP_FOLDER%\WorkPulseAgent.vbs" >nul 2>&1

:: 7. Launch immediately in background
echo [*] Starting agent in background now...
wscript.exe "%RUN_VBS%"

echo.
echo ============================================================
echo   [SUCCESS] WorkPulse Agent is installed and running!
echo   - Installed to: %INSTALL_DIR%
echo   - Auto-starts on Windows login silently in background.
echo   - Captures activity and screenshots automatically.
echo ============================================================
echo.
pause
