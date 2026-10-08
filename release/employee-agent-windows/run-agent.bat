@echo off
title Employee Tracking Agent
cd /d "%~dp0"
echo Starting Employee Tracking Background Agent...
employee-agent.exe
pause
