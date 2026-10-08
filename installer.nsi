; ==============================================================================
; NSIS INSTALLER SCRIPT FOR EMPLOYEE TRACKING AGENT
; Compiles a single-file standalone installer (EmployeeAgent-Setup.exe)
; ==============================================================================

!include "MUI2.nsh"
!include "LogicLib.nsh"

; General Settings
Name "Employee Tracking Agent"
OutFile "dist\EmployeeAgent-Setup.exe"
InstallDir "$PROGRAMFILES64\EmployeeAgent"
InstallDirRegKey HKLM "Software\EmployeeTrackingAgent" "Install_Dir"
RequestExecutionLevel admin

; UI Configuration
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Welcome to Employee Tracking Agent Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will install the Employee Tracking Background Agent on this computer.$\r$\n$\r$\nThe agent will automatically register with Windows Startup and begin monitoring authorized activity in the background."

!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "The Employee Tracking Agent has been installed and started successfully in the background.$\r$\n$\r$\nIt is now actively communicating with the central dashboard."

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "English"

; Installation Section
Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  
  ; 1. Stop any currently running instance before updating
  ExecWait 'taskkill /F /IM employee-agent.exe'
  
  ; 2. Extract agent binary
  File "dist\employee-agent-windows\employee-agent.exe"
  
  ; 3. Extract .env configuration only if it doesn't already exist (preserves existing config on upgrades)
  IfFileExists "$INSTDIR\.env" skip_env 0
    File "dist\employee-agent-windows\.env"
  skip_env:

  ; 4. Extract companion scripts and docs
  File "dist\employee-agent-windows\run-agent.bat"
  File "dist\employee-agent-windows\install-service.bat"
  File "dist\employee-agent-windows\README.md"
  
  ; 5. Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  ; 6. Register in Windows Programs & Features (Control Panel)
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EmployeeTrackingAgent" "DisplayName" "Employee Tracking Agent"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EmployeeTrackingAgent" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EmployeeTrackingAgent" "DisplayVersion" "0.1.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EmployeeTrackingAgent" "Publisher" "Enterprise Monitoring"
  WriteRegStr HKLM "Software\EmployeeTrackingAgent" "Install_Dir" "$INSTDIR"
  
  ; 7. Register in Windows Task Scheduler for automatic startup on user logon
  ExecWait 'schtasks /create /tn "EmployeeTrackingAgent" /tr "\"$INSTDIR\employee-agent.exe\"" /sc onlogon /rl highest /f'
  
  ; 8. Launch the background agent immediately
  Exec '"$INSTDIR\employee-agent.exe"'
SectionEnd

; Uninstallation Section
Section "Uninstall"
  ; 1. Terminate running agent process
  ExecWait 'taskkill /F /IM employee-agent.exe'
  
  ; 2. Delete Windows Task Scheduler registration
  ExecWait 'schtasks /delete /tn "EmployeeTrackingAgent" /f'
  
  ; 3. Delete installed files
  Delete "$INSTDIR\employee-agent.exe"
  Delete "$INSTDIR\run-agent.bat"
  Delete "$INSTDIR\install-service.bat"
  Delete "$INSTDIR\README.md"
  Delete "$INSTDIR\.env"
  Delete "$INSTDIR\uninstall.exe"
  
  ; 4. Remove installation directory
  RMDir "$INSTDIR"
  
  ; 5. Remove registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EmployeeTrackingAgent"
  DeleteRegKey HKLM "Software\EmployeeTrackingAgent"
SectionEnd
