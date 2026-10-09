# Agent ↔ Desktop lifecycle integration

## Stack discovered

- Desktop: Tauri 2 (`src-tauri`) + React (`src/`)
- Existing agent binary: `release/employee-agent-windows/employee-agent.exe` (source: `employee-agent/`)
- Do **not** use `agent/` (`employee-windows-agent`) for this integration

## Mechanism

Tauri hosts an `AgentSupervisor` that:

1. Installs `employee-agent.exe` under `%LOCALAPPDATA%\EmployeeTracking\agent\`
2. Writes `.env` (employee id + anon Supabase URL/key) for the agent
3. Spawns the agent as a **detached** Windows process (survives dashboard close)
4. Enforces single-instance via agent named mutex + process name check
5. Reports lifecycle only as **RUNNING** when process is alive **and** `status.json` heartbeat is fresh (&lt; 120s)
6. Pause via `PAUSE` file; stop via `STOP` file then `taskkill` if needed
7. Bounded crash recovery (max 5 restarts, exponential backoff)

## Window close

CloseRequested → **hide** main window (tray). Agent is **not** killed.

Tray:

- Open Dashboard
- Stop monitoring agent
- Exit dashboard (keep monitoring)
- Exit & stop monitoring

## Logout / Windows events

| Event | Behavior |
|-------|----------|
| Dashboard hide/close | Agent continues if started |
| Tray Exit & stop | Stops agent, quits app |
| Employee logout (UI) | Does not auto-kill agent (explicit Stop required) |
| Windows logoff/shutdown | OS ends user-session agent process |
| Sleep/hibernate | Collection suspends with OS; resumes when agent loop wakes / next start |
| Restart | Agent not a service by default; starts again when employee opens desktop app (authorized) or via optional Task Scheduler install bat |

## Health sources (not window presence)

- Process: `employee-agent.exe` in task list
- `status.json` written by agent (heartbeat / collection / upload timestamps)
- Office-hours + `PAUSE` for policy

## Auto-update (desktop)

- Channel: GitHub Releases `latest.json` for `permanentseoteam-dev/Employee-Tracking-Dashboard`
- App checks ~4s after launch; silent download + restart (`plugins.updater` + `createUpdaterArtifacts`)
- Local signed build: `npm run build:desktop` (uses `%USERPROFILE%\.tauri\employee-tracking.key`)
- CI: tag `v*` or run **Release Desktop** workflow (needs secrets `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`)

## Manual setup

1. Build/copy `employee-agent.exe` into `release/employee-agent-windows/` (bundled as Tauri resource when present)
2. Run desktop app as employee → Install / Start from dashboard panel
3. Optional login startup: existing `release/employee-agent-windows/install-service.bat` (Task Scheduler, user-visible)
