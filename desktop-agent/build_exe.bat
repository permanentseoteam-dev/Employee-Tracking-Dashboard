@echo off
title Build WorkPulse Agent Executable
echo Installing PyInstaller...
pip install pyinstaller --quiet

echo Building single-file executable...
pyinstaller --noconfirm --onedir --windowed --name "WorkPulseAgent" "%~dp0agent.py"

echo.
echo Build complete! The executable folder is in: %~dp0dist\WorkPulseAgent\
echo You can copy this folder or installer to employee computers.
pause
