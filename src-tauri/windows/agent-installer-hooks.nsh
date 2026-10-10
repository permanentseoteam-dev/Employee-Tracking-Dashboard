; Bundled with Tauri NSIS — installs employee-agent alongside the dashboard.
; Does not hide processes or request stealth persistence.

!macro NSIS_HOOK_PREINSTALL
  ; Ensure agent payload exists in package resources before we claim success later
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Installing Employee Monitoring Agent..."
  CreateDirectory "$LOCALAPPDATA\EmployeeTracking\agent"

  ; Tauri places bundle resources under $INSTDIR (often resources\ or nested)
  StrCpy $0 "$INSTDIR\resources\agent\employee-agent.exe"
  IfFileExists "$0" copy_agent
  StrCpy $0 "$INSTDIR\agent\employee-agent.exe"
  IfFileExists "$0" copy_agent
  StrCpy $0 "$INSTDIR\employee-agent.exe"
  IfFileExists "$0" copy_agent
  DetailPrint "ERROR: employee-agent.exe missing from installer package"
  MessageBox MB_ICONEXCLAMATION|MB_OK "Installation incomplete: employee-agent.exe was not found in the package. Re-download or rebuild the installer."
  SetErrorLevel 1
  Abort "employee-agent.exe missing"

  copy_agent:
  CopyFiles /SILENT "$0" "$LOCALAPPDATA\EmployeeTracking\agent\employee-agent.exe"
  IfFileExists "$LOCALAPPDATA\EmployeeTracking\agent\employee-agent.exe" agent_ok
  DetailPrint "ERROR: Failed to copy employee-agent.exe"
  MessageBox MB_ICONEXCLAMATION|MB_OK "Failed to install the monitoring agent binary."
  SetErrorLevel 1
  Abort "agent copy failed"

  agent_ok:
  ; Copy env template if present (secrets filled at first authorized sign-in)
  IfFileExists "$INSTDIR\resources\agent\agent.env.template" 0 skip_env
  CopyFiles /SILENT "$INSTDIR\resources\agent\agent.env.template" "$LOCALAPPDATA\EmployeeTracking\agent\agent.env.template"
  skip_env:

  IfFileExists "$INSTDIR\resources\agent\agent-manifest.json" 0 skip_manifest
  CopyFiles /SILENT "$INSTDIR\resources\agent\agent-manifest.json" "$LOCALAPPDATA\EmployeeTracking\agent\agent-manifest.json"
  skip_manifest:

  ; Copy MSVC runtime DLLs if bundled so other machines run without VCRUNTIME140.dll errors
  IfFileExists "$INSTDIR\resources\agent\vcruntime140.dll" 0 skip_vcruntime
  CopyFiles /SILENT "$INSTDIR\resources\agent\vcruntime140.dll" "$LOCALAPPDATA\EmployeeTracking\agent\vcruntime140.dll"
  CopyFiles /SILENT "$INSTDIR\resources\agent\msvcp140.dll" "$LOCALAPPDATA\EmployeeTracking\agent\msvcp140.dll"
  CopyFiles /SILENT "$INSTDIR\resources\agent\vcruntime140_1.dll" "$LOCALAPPDATA\EmployeeTracking\agent\vcruntime140_1.dll"
  skip_vcruntime:
  IfFileExists "$INSTDIR\agent\vcruntime140.dll" 0 skip_vcruntime_alt
  CopyFiles /SILENT "$INSTDIR\agent\vcruntime140.dll" "$LOCALAPPDATA\EmployeeTracking\agent\vcruntime140.dll"
  CopyFiles /SILENT "$INSTDIR\agent\msvcp140.dll" "$LOCALAPPDATA\EmployeeTracking\agent\msvcp140.dll"
  CopyFiles /SILENT "$INSTDIR\agent\vcruntime140_1.dll" "$LOCALAPPDATA\EmployeeTracking\agent\vcruntime140_1.dll"
  skip_vcruntime_alt:


  ; User-visible Task Scheduler entry (on logon) — least privilege, no service
  DetailPrint "Registering agent for user logon startup..."
  nsExec::ExecToLog 'schtasks /Create /TN "EmployeeTrackingAgent" /TR "\"$LOCALAPPDATA\EmployeeTracking\agent\employee-agent.exe\"" /SC ONLOGON /RL LIMITED /F'
  DetailPrint "Agent installed to $LOCALAPPDATA\EmployeeTracking\agent"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping monitoring agent..."
  nsExec::ExecToLog 'taskkill /IM employee-agent.exe /F'
  nsExec::ExecToLog 'schtasks /Delete /TN "EmployeeTrackingAgent" /F'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove local agent binaries/config only — never touch Supabase cloud data
  RMDir /r "$LOCALAPPDATA\EmployeeTracking\agent"
  DetailPrint "Local agent files removed. Cloud monitoring history was not deleted."
!macroend
