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

## Office hours

Screenshot capture is gated by office hours (default Mon–Fri 09:00–17:00, workstation local clock).

Env overrides:

| Variable | Default | Meaning |
|---|---|---|
| `OFFICE_HOURS_ENABLED` | `true` | When false, capture 24/7 |
| `WORK_START` | `09:00` | Local start time |
| `WORK_END` | `17:00` | Local end time |
| `WORK_DAYS` | `mon,tue,wed,thu,fri` | Allowed weekdays |
| `CAPTURE_OUTSIDE_HOURS` | `false` | Force capture outside the window |
| `CONFIG_REFRESH_SECONDS` | `300` | How often to re-fetch Supabase policy |

Remote policy: `public.agent_runtime_config` (single row `id=1`), editable in Admin → Settings. Env values apply until the first successful remote fetch.

## Running the Agent

```powershell
$env:CARGO_TARGET_DIR="C:\Users\ok\.cargo_targets\employee_agent_mvp"
cargo run --release
```
