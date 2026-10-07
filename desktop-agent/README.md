# WorkPulse Desktop Agent — Deployment & Installation Guide

This folder contains the client desktop agent that runs on employee Windows laptops or PCs to record attendance, aggregate input activity, and capture periodic compressed screenshots.

---

## 🔒 Privacy & Architecture Guarantees
- **Zero Keylogging**: The agent uses an atomic integer counter (`key_press_count += 1`). No keys, typed characters, passwords, or clipboard text are ever inspected or recorded.
- **Client-Side Compression**: Screenshots are captured, resized down to 1280x720, and compressed into WebP (q=65) locally before upload, keeping file sizes to ~45–80 KB.
- **Offline Persistence**: If the internet or corporate network drops, data and screenshots enter a local encrypted SQLite database (`agent_queue.db`) and automatically sync once the connection is restored.
- **Low Footprint**: Consumes <0.5% CPU and ~30 MB RAM.

---

## 🚀 Quick Setup on Employee PC

### Method 1: Python Script (Fastest)

1. **Copy the `desktop-agent/` folder** to the employee computer (e.g. `C:\Program Files\WorkPulseAgent\` or `C:\Users\<user>\WorkPulseAgent\`).
2. **Edit `config.json`**:
   ```json
   {
     "server_url": "http://YOUR_SERVER_IP_OR_DOMAIN:8000",
     "employee_code": "EMP001",
     "sync_interval_seconds": 60,
     "screenshot_interval_seconds": 600,
     "screenshot_quality": 65
   }
   ```
   *Note: Replace `YOUR_SERVER_IP_OR_DOMAIN` with your backend server's IP (e.g. `http://192.168.1.100:8000` or public domain), and set the employee's designated code (e.g. `EMP001`, `EMP002`).*
3. **Double-click `run_agent.bat`** or run:
   ```cmd
   pip install -r requirements.txt
   python agent.py
   ```
4. The agent will:
   - Auto-detect the hardware UUID and computer hostname.
   - Register the device with the backend server.
   - Record Windows login and first activity (marking attendance).
   - Begin periodic activity sync and screenshot capture.

---

### Method 2: Standalone Windows `.exe` (Zero Python on Employee PC)

1. On your development PC, run `build_exe.bat`.
2. PyInstaller will bundle the agent into `desktop-agent/dist/WorkPulseAgent/`.
3. Copy the `WorkPulseAgent` folder to the employee computer.
4. Update `config.json` inside that folder with the server URL and employee code.
5. Create a Windows shortcut in `shell:startup` so the agent starts automatically upon Windows boot.

---

## 🛠️ Auto-Start on Windows Boot (Task Scheduler)
To ensure the agent launches silently when the employee turns on their laptop:
1. Press `Win + R`, type `taskschd.msc`, and press Enter.
2. Click **Create Task...**
   - Name: `WorkPulse Desktop Agent`
   - Security options: Select **Run whether user is logged on or not** or **Run only when user is logged on**.
3. **Triggers**: New $\rightarrow$ **At log on** (Any user).
4. **Actions**: New $\rightarrow$ **Start a program** $\rightarrow$ Browse to `agent.py` (or `WorkPulseAgent.exe`).
5. Click **OK**.
