@echo off
:: Install Task Scheduler background agent
echo Registering Employee Tracking Agent with Windows Task Scheduler...
schtasks /create /tn "EmployeeTrackingAgent" /tr "\"%~dp0employee-agent.exe\"" /sc onlogon /rl highest /f
echo Starting agent now...
schtasks /run /tn "EmployeeTrackingAgent"
echo Done! Employee Tracking Agent is now running in the background.
pause
