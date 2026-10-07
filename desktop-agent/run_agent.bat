@echo off
title WorkPulse Desktop Agent
echo Starting WorkPulse Desktop Agent...
python -m pip install -r "%~dp0requirements.txt" --quiet
python "%~dp0agent.py"
pause
