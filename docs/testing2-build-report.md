# testing2.md — One-installer build report

## 1. Root cause (why install alone did not show live admin data)

1. **Separate agent package** — dashboard NSIS did not reliably ship `employee-agent.exe`.
2. **No post-install registration** — agent was not copied to LocalAppData or registered for logon.
3. **Manual agent launch** — monitoring only worked if someone ran `employee-agent.exe` separately.
4. **Mock status** — dashboard previously claimed “running” without a real agent process/heartbeat.

Live admin data requires a **running agent** that heartbeats and uploads to Supabase — not merely an installed UI.

## 2. Modified / added files

| Path | Role |
|------|------|
| `scripts/prepare-agent-bundle.mjs` | Copies agent into `src-tauri/resources/agent` + manifest |
| `src-tauri/resources/agent/*` | Bundled agent + template (build artifact) |
| `src-tauri/windows/agent-installer-hooks.nsh` | NSIS copy + schtasks + uninstall cleanup |
| `src-tauri/tauri.conf.json` | Resources map + NSIS hooks + prepare before build |
| `package.json` | `prepare:agent`, `build:agent`, `build:desktop` |
| `src-tauri/src/agent_supervisor/mod.rs` | Bundle paths, size verify, logon task |
| `src-tauri/src/lib.rs` | Install from `resource_dir` on app start |
| `employee-agent/*` | Lock-file single-instance, status.json, PAUSE/STOP |
| `src/App.tsx` | Silent employee bootstrap (no UI panel) |

## 3. Installer configuration

- Target: **NSIS**, `installMode: currentUser`
- Hooks: `src-tauri/windows/agent-installer-hooks.nsh`
- Resources: `agent/employee-agent.exe`, manifest, env template

## 4. Packaging & startup

1. NSIS **POSTINSTALL** copies agent → `%LOCALAPPDATA%\EmployeeTracking\agent\`
2. Registers Task Scheduler task **EmployeeTrackingAgent** (ONLOGON, LIMITED)
3. On first authorized employee desktop session: configure `.env` (URL + anon key + employee id) and start agent if not running
4. Agent is detached; closing dashboard does not kill it
5. Uninstall stops agent, deletes schtasks + local agent files; **does not** delete Supabase data

## 5. Database / auth changes

None required for this packaging task. Agent continues to use anon key + existing tables/storage.

## 6. Tests executed in this environment

| Check | Result |
|-------|--------|
| `cargo build --release` employee-agent | Pass |
| `prepare-agent-bundle` (sha256 recorded) | Pass |
| `npm run build:desktop` (NSIS) | Pass |
| Clean Windows install → first heartbeat → admin UI | **Not run here** (needs machine install) |

## 7. Installer path

```
f:\TrackingDashboard\release\desktop\Employee Tracking App_0.1.0_x64-setup.exe
```

Also produced at:

```
f:\TrackingDashboard\target-employee-agent\release\bundle\nsis\Employee Tracking App_0.1.0_x64-setup.exe
```

Bundled agent sha256: `4e0fa47b24712848c46e92162f79a2cc708ab28cad3404c086b586f8d96af264`

## 8. Remaining limitations / manual steps

- First run still needs **employee sign-in / role** so `EMPLOYEE_ID` is written correctly (no arbitrary ID).
- Admin sees live data only after a real heartbeat/upload (truthful status until then).
- Office-hours policy can skip screenshots outside the window.
- Full matrix from testing2.md §10 should be run on a clean Windows VM after install.
- No git commit was made (per task constraint).
