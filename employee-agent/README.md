# Employee Agent (Windows Native Rust Agent)

The background monitoring agent captures periodic screenshots, compresses them with JPEG encoding, uploads them directly to Supabase Storage, registers screenshot metadata in PostgreSQL, and streams presence & telemetry heartbeats.

## Execution Flow

```
Agent Starts
     ↓
Load Configuration (.env / system env)
     ↓
Identify Employee & Device Workstation
     ↓
Capture Screenshot (Win32 GDI / BitBlt)
     ↓
Compress Screenshot (JPEG 70% quality)
     ↓
Upload to Supabase Storage (/storage/v1/object/screenshots)
     ↓
Save Screenshot Metadata in PostgreSQL (public.screenshots)
     ↓
Send Presence Heartbeat (public.employee_presence / public.employees)
     ↓
Wait for Next Interval (e.g., 60s)
     ↓
Repeat
```

## Running the Agent

```powershell
$env:CARGO_TARGET_DIR="C:\Users\ok\.cargo_targets\employee_agent_mvp"
cargo run
```
