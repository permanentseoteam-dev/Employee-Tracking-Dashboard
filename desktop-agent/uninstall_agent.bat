@echo off
title WorkPulse Agent — Uninstaller
echo ============================================================
echo          WorkPulse Desktop Agent — Uninstaller
echo ============================================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\WorkPulseAgent"
set "TASK_NAME=WorkPulseDesktopAgent"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo [*] Terminating running agent process...
taskkill /f /im WorkPulseAgent.exe >nul 2>&1

echo [*] Removing Windows Task Scheduler auto-start task...
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

echo [*] Removing Windows Startup folder entry...
if exist "%STARTUP_FOLDER%\WorkPulseAgent.vbs" del /f /q "%STARTUP_FOLDER%\WorkPulseAgent.vbs" >nul 2>&1

echo [*] Removing installed directory...
if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%" >nul 2>&1

echo.
echo ============================================================
echo   [SUCCESS] WorkPulse Agent has been completely removed!
echo ============================================================
echo.
pause
