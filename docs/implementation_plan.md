# Windows Desktop Employee Tracking Agent — Implementation Plan

## 1. System Overview & Architectural Guardrails

### 1.1 Strict Compliance & Hard Rules
1. **Zero Keystroke / Raw Content Logging**: Only aggregate counts (`keyboard_press_count`, `mouse_move_count`, `mouse_click_count`, `active_seconds`, `idle_seconds`). Never inspect, record, or store character codes.
2. **No Video / Live Streaming**: Live streaming, continuous video recording, and remote live screen viewing are strictly excluded from the MVP.
3. **Real Metrics Only**: Every number and status rendered in the UI directly reflects verified local agent state, SQLite outbox status, or backend-synchronized metrics. No mock placeholders or decorative-only controls.
4. **Secret-Free Logging & Windows Credential Store**: Passwords and JWT tokens are stored exclusively in the Windows Credential Manager (via Windows Credential Vault APIs) and never in SQLite or plain files. The logger automatically scrubs and redacts auth tokens and credentials before writing to disk.
5. **Offline-First Outbox Pattern**: All telemetry, screenshots, task sessions, and attendance events are committed to a local SQLite outbox queue first with a unique UUID v4. The background sync worker delivers items reliably with exponential backoff and prevents duplicate submissions.
6. **Low Resource Footprint**: Non-blocking asynchronous I/O, event debouncing, batching metrics in 60-second windows, and zero spin-polling.
7. **Transparent Agent Presence**: Un-cloaked visible tray icon, dynamic status tooltip, and explicit monitoring indicator in the desktop UI shell.
8. **Platform Abstraction**: All OS-specific hooks (idle detection, input hooks, display capture, credentials) are hidden behind a generic Rust `PlatformService` trait to allow future Linux and macOS ports.

---

## 2. Directory & Module Structure

```text
f:/Tracking Dashboard/
├── arch.md
├── design.md
├── prd.md
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── index.html
├── src/                                  # React 18+ TypeScript Frontend
│   ├── assets/                           # Brand assets, icons, logos
│   ├── components/
│   │   ├── common/                       # Buttons, Cards, Badges, Modals
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Modal.tsx
│   │   └── layout/                       # App shell per design.md
│   │       ├── AppShell.tsx
│   │       ├── TopBar.tsx                # Logo, search, notification, user
│   │       └── Sidebar.tsx               # Nav links + Agent Status footer
│   ├── hooks/
│   │   ├── useAgentState.ts              # Agent online/offline, active/idle
│   │   ├── useAuth.ts                    # Auth session hook
│   │   ├── useConfig.ts                  # Remote/local config
│   │   └── useTimer.ts                   # Task timer state
│   ├── pages/
│   │   ├── DashboardPage.tsx             # Overview: status, attendance, active task
│   │   ├── AttendancePage.tsx            # First activity, punch events, schedule
│   │   ├── TasksPage.tsx                 # Assigned tasks, start/stop
│   │   ├── ProjectsPage.tsx              # Projects directory
│   │   ├── PerformancePage.tsx           # Aggregate metrics charts & stats
│   │   ├── TimerPage.tsx                 # Precision timestamp timer & breaks
│   │   └── SettingsPage.tsx              # Agent settings, DB health, logs
│   ├── services/
│   │   └── tauriBridge.ts                # Strongly typed invoke/listen wrappers
│   ├── styles/
│   │   ├── index.css                     # Design tokens & base variables
│   │   ├── shell.css                     # TopBar, Sidebar, AppShell
│   │   └── pages.css                     # Page component styles
│   ├── types/
│   │   └── index.ts                      # Shared TypeScript DTOs
│   ├── App.tsx
│   └── main.tsx
│
└── src-tauri/                            # Rust Core
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    ├── icons/                            # App and System Tray icons
    │   ├── 32x32.png
    │   ├── 128x128.png
    │   └── icon.ico
    └── src/
        ├── main.rs                       # Entrypoint, plugin wiring, tray setup
        ├── core/                         # Core infrastructure
        │   ├── mod.rs
        │   ├── config.rs                 # Local & remote versioned configuration
        │   ├── error.rs                  # AppError and Result types
        │   ├── logging.rs                # Tracing setup + token redacting filter
        │   └── db/                       # SQLite management
        │       ├── mod.rs                # Connection pool and helpers
        │       ├── migrations.rs         # Schema migration engine
        │       └── migrations/           # Embedded SQL migrations
        │           ├── 001_initial_schema.sql
        │           └── 002_outbox_queue.sql
        ├── platform/                     # OS abstraction layer
        │   ├── mod.rs                    # PlatformService trait
        │   └── windows.rs                # Windows Win32 API implementation
        ├── security/                     # Credential store & crypto
        │   ├── mod.rs
        │   └── credentials.rs            # Windows Credential Manager integration
        ├── tray/                         # System Tray
        │   └── mod.rs                    # Tray menu, status items, click handlers
        └── commands/                     # Tauri IPC command handlers
            ├── mod.rs
            ├── system.rs                 # get_agent_status, get_system_info
            ├── config.rs                 # get_config, update_config
            └── logs.rs                   # get_recent_logs
```

---

## 3. SQLite Database Schema & Migrations

All operations run locally first. Schema changes are version-controlled and applied atomically within transactions:

### Migration 001: Core Entities & Outbox
```sql
-- Schema migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Local key-value store for app configuration
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Hardware & OS Device Identity
CREATE TABLE IF NOT EXISTS device_info (
    device_id TEXT PRIMARY KEY,
    hostname TEXT NOT NULL,
    os_name TEXT NOT NULL,
    os_version TEXT NOT NULL,
    agent_version TEXT NOT NULL,
    registered_at TEXT,
    last_heartbeat TEXT
);

-- Active User Session State (Tokens are in Credential Vault, metadata here)
CREATE TABLE IF NOT EXISTS auth_session (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_email TEXT NOT NULL,
    access_token_vault_key TEXT NOT NULL,
    refresh_token_vault_key TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Reliable Outbox Queue (Write-locally-first pattern)
CREATE TABLE IF NOT EXISTS outbox_queue (
    id TEXT PRIMARY KEY,                       -- UUID v4 (idempotency key)
    event_type TEXT NOT NULL,                  -- 'activity_aggregate', 'attendance', 'screenshot', 'task_event'
    payload TEXT NOT NULL,                     -- JSON payload (encrypted if offline security enabled)
    status TEXT NOT NULL DEFAULT 'pending',    -- 'pending', 'sending', 'sent', 'failed'
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_queue(status, next_retry_at);

-- 60-second Aggregated Activity Windows (Never individual characters)
CREATE TABLE IF NOT EXISTS activity_aggregates (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    key_press_count INTEGER NOT NULL DEFAULT 0,
    mouse_move_count INTEGER NOT NULL DEFAULT 0,
    mouse_click_count INTEGER NOT NULL DEFAULT 0,
    active_seconds INTEGER NOT NULL DEFAULT 0,
    idle_seconds INTEGER NOT NULL DEFAULT 0,
    is_idle INTEGER NOT NULL DEFAULT 0,
    synced_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_activity_window ON activity_aggregates(window_start);

-- Attendance Detection Records
CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    date TEXT NOT NULL,
    first_activity_at TEXT NOT NULL,
    event_type TEXT NOT NULL,                  -- 'check_in', 'auto_first_activity'
    status TEXT NOT NULL DEFAULT 'pending',
    synced_at TEXT
);

-- Task Sessions and Breaks (Survives application crash/restart)
CREATE TABLE IF NOT EXISTS task_sessions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    task_title TEXT NOT NULL,
    project_id TEXT,
    project_name TEXT,
    employee_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    total_seconds INTEGER NOT NULL DEFAULT 0,
    break_seconds INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running',    -- 'running', 'paused', 'break', 'completed'
    synced_at TEXT
);

CREATE TABLE IF NOT EXISTS break_records (
    id TEXT PRIMARY KEY,
    task_session_id TEXT NOT NULL,
    break_type TEXT NOT NULL,                  -- 'general', 'namaz'
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    synced_at TEXT,
    FOREIGN KEY(task_session_id) REFERENCES task_sessions(id) ON DELETE CASCADE
);

-- Screenshot Metadata (Images temporarily stored in local app data before upload)
CREATE TABLE IF NOT EXISTS screenshot_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    file_size_bytes INTEGER NOT NULL,
    upload_status TEXT NOT NULL DEFAULT 'pending',
    synced_at TEXT
);
```

---

## 4. Tauri Typed Commands & Event API

### 4.1 System Commands
| Command Name | Arguments | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `get_agent_status` | None | `AgentStatusDto` | Returns live status: running, online/offline, active/idle, version |
| `get_system_info` | None | `SystemInfoDto` | Returns hostname, OS version, device ID |
| `get_recent_logs` | `{ limit?: number }` | `LogEntryDto[]` | Returns recent redacted logs for troubleshooting |

### 4.2 Configuration Commands
| Command Name | Arguments | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `get_app_config` | None | `AppConfigDto` | Fetches active tracking thresholds and settings |
| `update_app_config` | `{ config: UpdateConfigDto }` | `AppConfigDto` | Updates local configurable thresholds |

### 4.3 Database Diagnostics
| Command Name | Arguments | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `get_database_stats` | None | `DbStatsDto` | Row counts for outbox, activities, screenshots, migration version |

### 4.4 Tauri Events Emitted to UI
- `agent://status-changed`: Emitted when online/offline or active/idle state changes.
- `agent://outbox-updated`: Emitted when items are queued or successfully synced.
- `agent://timer-tick`: Emitted once per second during an active task timer.

---

## 5. React Frontend Architecture & Design Specification

### 5.1 Shell Layout (Strictly per `design.md`)
- **TopBar**:
  - Left: Application logo & branding title (`Tracking Agent`).
  - Center: Global search input (`Search tasks, attendance, projects...`).
  - Right: Outbox sync indicator badge, Notifications bell with unread count, User profile chip with status dot.
- **Sidebar**:
  - Navigation items:
    - 📊 Dashboard
    - 🕒 Attendance
    - 📋 My Tasks
    - 📁 Projects
    - 📈 Performance
    - ⏱️ Timer
    - ⚙️ Settings
  - Footer:
    - Visible Agent Monitor card (`Agent Active`, `Status: Monitoring`, version indicator).
- **Main Content**:
  - Dynamically routed pages based on sidebar selection, keeping full state and fast transitions.

### 5.2 UI Principles
- **No placeholder / dummy data**: Real state retrieved via `invoke()`.
- **Minimal, enterprise-grade aesthetic**: Neutral slate/zinc dark palette (`#0f172a`, `#1e293b`), crisp typography (`Inter`), clean 1px borders, subtle hover transitions.
- **Immediate visual feedback**: Every button triggers an IPC command or state transition.

---

## 6. Phased Implementation Roadmap

1. **Phase 1: Foundation, App Shell, Database & System Tray (Current Phase)**
   - Project scaffolding: React 18 + TypeScript + Vite + Tauri v2.
   - Rust core setup: `core::config`, `core::logging` (with token/password redacting filter), `core::db` with migration runner.
   - SQLite migration 001 execution and verified schema tables.
   - Windows Platform abstraction layer with credential vault helpers.
   - System Tray integration with menu items and visible status.
   - React UI Shell (`TopBar`, `Sidebar`, `AppShell`, design tokens).
   - Rust unit tests for config, migrations, and log redaction.

2. **Phase 2: Authentication & Device Registration**
   - Windows Credential Manager integration (`keyring` crate).
   - Mock backend REST API for login, logout, token refresh, and device registration.
   - Login page, session management, and auth expiry handling.

3. **Phase 3: Activity Monitoring & Attendance Engine**
   - Windows low-level input hooks (aggregate counts only; never store key codes).
   - Idle detection (GetLastInputInfo) and active/idle state transitions.
   - First meaningful activity detection and attendance event creation.

4. **Phase 4: Screenshot Capture & Optimization**
   - Desktop screenshot capture (display selection).
   - High-performance resizing, JPEG compression, and thumbnail generation.
   - Outbox storage and automatic file cleanup after successful sync.

5. **Phase 5: Encrypted Offline Queue & Sync Engine**
   - SQLite outbox worker with retry schedule and exponential backoff.
   - Idempotent deduplication using UUID v4 keys.
   - Network connectivity listener and auto-sync on reconnect.

6. **Phase 6: Task Management, Timestamp Timer & Breaks**
   - Task listing and task selection.
   - Crash-proof timestamp-based timer (stores start timestamp and break intervals).
   - General break and Namaz break workflows with accurate productive time calculation.

7. **Phase 7: Remote Versioned Config, Health & Verification**
   - Remote configuration pull and version comparison.
   - Heartbeat and agent health monitoring.
   - End-to-end integration tests and production packaging.
