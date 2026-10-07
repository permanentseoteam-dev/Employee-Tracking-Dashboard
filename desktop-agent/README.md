# WorkPulse Desktop Agent — Deployment & Installation Guide

This folder contains the client desktop agent that runs on employee Windows laptops or PCs to record attendance, aggregate input activity, and capture periodic compressed screenshots.

---

## 🔒 Privacy & Architecture Guarantees
- **Zero Keylogging**: The agent uses an atomic integer counter (`key_press_count += 1`). No keys, typed characters, passwords, or clipboard text are ever inspected or recorded.
- **Client-Side Compression**: Screenshots are captured, resized down to 1280x720, and compressed into WebP (q=65) locally before upload, keeping file sizes to ~45–80 KB.
- **Offline Persistence**: If the internet or corporate network drops, data and screenshots enter a local encrypted SQLite database (`agent_queue.db`) and automatically sync once the connection is restored.
- **Low Footprint**: Consumes <0.5% CPU and ~30 MB RAM.

---

## 🚀 Quick Setup on Employee PC (1-Click Automated Setup)

### Recommended: 1-Click Automated Installer (`install_agent.bat`)
To install the agent permanently so it **auto-starts silently on every Windows boot**:

1. Copy the `desktop-agent/` folder to the employee PC (or USB drive).
2. Right-click **`install_agent.bat`** and click **Run**.
3. It will prompt for:
   - **Employee Code**: (e.g. `EMP002`, `EMP003`).
   - **Server URL**: (e.g. `http://YOUR_SERVER_IP:8000`).
4. **What the installer does automatically**:
   - Copies files into `%LOCALAPPDATA%\WorkPulseAgent\`.
   - Creates a silent windowless launcher script.
   - Registers a **Windows Task Scheduler** task (`WorkPulseDesktopAgent`) to start automatically upon Windows logon.
   - Adds a fallback entry to the user's **Windows Startup** folder.
   - Immediately starts the agent in the background.

*To remove anytime, just run `uninstall_agent.bat`.*

---

### Standalone Executable (`WorkPulseAgent.exe` - Option B)
If you build or distribute the standalone `.exe`:
1. On your machine, run **`build_exe.bat`** to produce `dist/WorkPulseAgent/WorkPulseAgent.exe` (or a standalone `.exe`).
2. **Auto-Install & Auto-Start Behavior**:
   - **Method A (Easiest - 1-Click Installer)**: Place `WorkPulseAgent.exe` alongside [`install_agent.bat`](file:///f:/Tracking%20Dashboard/desktop-agent/install_agent.bat) and run `install_agent.bat`. It copies the `.exe` to `%LOCALAPPDATA%\WorkPulseAgent`, registers Windows Task Scheduler (`/sc onlogon`), and launches immediately in the background without any console window.
   - **Method B (Direct Double-Click)**: The agent has built-in auto-registration. The first time `WorkPulseAgent.exe` is run, it registers itself into the Windows user startup registry (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`), ensuring it launches automatically whenever the employee boots or logs into Windows.
3. *To uninstall anytime, simply run `uninstall_agent.bat`.*

