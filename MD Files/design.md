# System Design & Data Specifications — Employee Tracking Platform

## 1. Database Schema Design (PostgreSQL)

```mermaid
erDiagram
    DEPARTMENTS ||--o{ EMPLOYEES : "has"
    EMPLOYEES ||--o{ EMPLOYEES : "manages"
    EMPLOYEES ||--o{ DEVICES : "assigned to"
    EMPLOYEES ||--o{ ATTENDANCES : "records"
    EMPLOYEES ||--o{ ACTIVITY_LOGS : "generates"
    EMPLOYEES ||--o{ MOUSE_HEATMAPS : "aggregates"
    EMPLOYEES ||--o{ SCREENSHOTS : "captures"
    EMPLOYEES ||--o{ EMPLOYEE_STARS : "awarded"
    EMPLOYEES ||--o{ AUDIT_LOGS : "acted upon"

    DEPARTMENTS {
        uuid id PK
        varchar name
        varchar code
        timestamp created_at
    }

    EMPLOYEES {
        uuid id PK
        varchar employee_code UK
        varchar full_name
        varchar email UK
        varchar password_hash
        varchar role "ADMIN | MANAGER | EMPLOYEE"
        varchar status "ACTIVE | INACTIVE | SUSPENDED"
        uuid department_id FK
        uuid manager_id FK
        timestamp created_at
        timestamp updated_at
    }

    DEVICES {
        uuid id PK
        uuid employee_id FK
        varchar device_identifier UK "Hardware UUID / MAC Hash"
        varchar hostname
        varchar os_version
        varchar agent_version
        varchar api_token_hash
        timestamp last_heartbeat
        varchar status "ACTIVE | REVOKED"
        timestamp registered_at
    }

    ATTENDANCES {
        uuid id PK
        uuid employee_id FK
        date work_date UK "Composite (employee_id, work_date)"
        timestamptz boot_time
        timestamptz login_time
        timestamptz first_activity
        timestamptz last_activity
        integer active_seconds
        integer idle_seconds
        varchar status "PRESENT | LATE | ABSENT | EARLY | OFFLINE"
        jsonb rule_eval_context "Audit trace of schedule & evaluated rules"
        timestamptz created_at
        timestamptz updated_at
    }

    ACTIVITY_LOGS {
        bigserial id PK
        uuid employee_id FK
        uuid device_id FK
        timestamptz start_time
        timestamptz end_time
        integer key_press_count
        integer mouse_click_count
        integer mouse_move_count
        integer active_seconds
        integer idle_seconds
        timestamptz created_at
    }

    MOUSE_HEATMAPS {
        bigserial id PK
        uuid employee_id FK
        uuid device_id FK
        timestamptz window_start
        timestamptz window_end
        integer screen_width
        integer screen_height
        integer grid_cols "Default: 20"
        integer grid_rows "Default: 12"
        jsonb grid_matrix "2D array or sparse map of cell interaction counts"
        timestamptz created_at
    }

    SCREENSHOTS {
        uuid id PK
        uuid employee_id FK
        uuid device_id FK
        varchar s3_key
        varchar thumbnail_s3_key
        integer file_size_bytes
        varchar format "webp"
        integer width
        integer height
        timestamptz captured_at
        timestamptz created_at
    }

    SETTINGS_AND_RULES {
        uuid id PK
        varchar rule_type "ATTENDANCE | STAR | MONITORING | RETENTION"
        varchar name
        boolean is_active
        jsonb config_payload "Extensible parameter gap"
        timestamptz updated_at
    }

    EMPLOYEE_STARS {
        uuid id PK
        uuid employee_id FK
        date award_date
        integer star_count
        varchar reason
        jsonb criteria_snapshot
        timestamptz awarded_at
    }

    AUDIT_LOGS {
        bigserial id PK
        uuid actor_id FK
        varchar action
        varchar entity_type
        varchar entity_id
        jsonb change_diff
        varchar ip_address
        timestamptz timestamp
    }
```

---

## 2. API Contract Specifications

### 2.1 Authentication & Profile
- `POST /api/v1/auth/login`
  - **Body**: `{ "email": "admin@org.com", "password": "..." }`
  - **Response (200)**: `{ "access_token": "...", "token_type": "bearer", "user": { "id": "...", "role": "ADMIN", "name": "..." } }`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

---

### 2.2 Agent Ingestion Endpoints (Device Authenticated)
- `POST /api/v1/agent/heartbeat`
  - **Headers**: `X-Device-Token: <token>`
  - **Body**: `{ "device_id": "...", "agent_version": "1.0.0", "timestamp": "2026-10-07T09:00:00Z" }`
  - **Response (200)**: `{ "status": "ok", "sync_interval_seconds": 300, "monitoring_active": true }`

- `POST /api/v1/agent/sync/batch`
  - **Headers**: `X-Device-Token: <token>`
  - **Body**:
    ```json
    {
      "employee_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "device_id": "7fa85f64-5717-4562-b3fc-2c963f66afa7",
      "system_events": [
        { "event_type": "BOOT", "timestamp": "2026-10-07T08:30:00Z" },
        { "event_type": "LOGIN", "timestamp": "2026-10-07T08:50:00Z" }
      ],
      "activity_batches": [
        {
          "start_time": "2026-10-07T09:00:00Z",
          "end_time": "2026-10-07T09:05:00Z",
          "key_press_count": 428,
          "mouse_click_count": 71,
          "mouse_move_count": 1942,
          "active_seconds": 271,
          "idle_seconds": 29
        }
      ],
      "heatmap_batches": [
        {
          "window_start": "2026-10-07T09:00:00Z",
          "window_end": "2026-10-07T09:05:00Z",
          "screen_width": 1920,
          "screen_height": 1080,
          "grid_cols": 20,
          "grid_rows": 12,
          "grid_matrix": { "0,0": 14, "0,1": 8, "5,8": 32 }
        }
      ]
    }
    ```
  - **Response (200)**: `{ "processed_batches": 1, "acknowledged_until": "2026-10-07T09:05:00Z" }`

- `POST /api/v1/agent/screenshots/upload`
  - **Payload**: `multipart/form-data` with fields: `metadata` (JSON), `file` (WebP binary stream).
  - **Response (201)**: `{ "screenshot_id": "...", "uploaded_at": "2026-10-07T09:10:00Z" }`

---

### 2.3 Dashboard APIs (Admin / Manager / Employee)
- `GET /api/v1/dashboard/metrics`
  - Returns counts: `total_employees`, `present`, `late`, `absent`, `offline`, `avg_attendance_pct`, `total_stars`.
- `GET /api/v1/attendance`
  - **Query**: `?date_from=2026-10-01&date_to=2026-10-07&department_id=&employee_id=&page=1&limit=25`
- `GET /api/v1/activity/statistics`
  - Returns hourly/daily aggregated active/idle times, keypress & mouse totals.
- `GET /api/v1/activity/heatmap`
  - Returns composite heatmap matrix for a chosen employee and time window.
- `GET /api/v1/screenshots`
  - **Query**: `?employee_id=...&date=2026-10-07&page=1&limit=24`
  - **Response (200)**:
    ```json
    {
      "items": [
        {
          "id": "uuid",
          "employee_name": "Jane Doe",
          "captured_at": "2026-10-07T09:10:15Z",
          "thumbnail_url": "https://s3.example.com/presigned-thumb-url?...",
          "full_url": "https://s3.example.com/presigned-full-url?...",
          "device_hostname": "DESKTOP-JDOE"
        }
      ],
      "total": 48,
      "page": 1,
      "total_pages": 2
    }
    ```
- `GET /api/v1/rules` & `PUT /api/v1/rules/:id`
  - Reads & configures working schedules, attendance grace periods, star criteria, and retention limits.

---

## 3. UI/UX & Dashboard Page Structure

```mermaid
flowchart LR
    subgraph AdminPortal["Admin Dashboard Portal"]
        A_Overview["/dashboard (KPI Overview)"]
        A_Emp["/employees (CRUD + Assignment)"]
        A_Att["/attendance (Org Roll Call)"]
        A_Screens["/screenshots (Org Gallery)"]
        A_Act["/activity (Metrics & Heatmaps)"]
        A_Rules["/rules (Attendance & Star Config)"]
        A_Devices["/devices (Registration & Status)"]
        A_Settings["/settings (Retention & Intervals)"]
        A_Audit["/audit-logs (Immutable History)"]
    end

    subgraph ManagerPortal["Manager Dashboard Portal"]
        M_Overview["/dashboard (Team KPIs)"]
        M_Team["/team (Direct Reports List)"]
        M_Att["/attendance (Team Attendance)"]
        M_Screens["/screenshots (Team Gallery)"]
        M_Act["/activity (Team Activity Stats)"]
        M_Perf["/performance (Team Ranking & Stars)"]
    end

    subgraph EmployeePortal["Employee Dashboard Portal"]
        E_Overview["/dashboard (Personal Summary)"]
        E_Att["/attendance (My Clock & Records)"]
        E_Act["/activity (My Active/Idle Stats)"]
        E_Stars["/stars (My Star Badges & Reasons)"]
        E_History["/history (Historical Attendance)"]
    end
```

### 3.1 Screenshot Gallery Component
- **Grid Layout**: Responsive grid (3 to 6 cards per row).
- **Lazy Loading**: Virtualized scroll or 24-item pagination.
- **Lightbox / Modal**: Clicking any card opens full-resolution WebP modal with timestamp, employee details, and previous/next navigation buttons.
- **Filters**: Employee picker (for Admin/Manager), date range, time-of-day slider, device selector.

### 3.2 Mouse Heatmap Canvas Component
- **20x12 Visual Grid**: Rendered on HTML5 Canvas over a neutral screen mockup template.
- **Density Gradient**: Normalized from low frequency (blue/green) to high frequency (yellow/red).
- **Time Window Filter**: Ability to scrub between 5-min intervals or view a whole-day aggregated density map.

---

## 4. Attendance & Star Rule Engines

### 4.1 Attendance Determination Logic

```mermaid
flowchart TD
    Start["Agent Sync Event / First Activity Timestamp"] --> FetchSched["Fetch Work Schedule (e.g. 09:00 AM)"]
    FetchSched --> CheckActivity{"Is first meaningful activity recorded?"}
    CheckActivity -- No --> MarkOffline["Status = OFFLINE / ABSENT (if day ends)"]
    CheckActivity -- Yes --> Compare{"first_activity <= (schedule_start + grace_period)?"}
    Compare -- Yes --> StatusPresent["Status = PRESENT"]
    Compare -- No --> StatusLate["Status = LATE"]
    StatusPresent --> SaveAtt["Update ATTENDANCES Record"]
    StatusLate --> SaveAtt
    MarkOffline --> SaveAtt
```

### 4.2 Extensible Rules Configuration Schema (JSONB gap)
The database stores rule configurations in JSONB format, allowing admin-customizable parameters without schema migrations:

```json
{
  "attendance_rules": {
    "shift_start": "09:00:00",
    "shift_end": "18:00:00",
    "grace_period_minutes": 10,
    "minimum_active_hours_for_full_day": 7.0,
    "half_day_threshold_hours": 4.0
  },
  "star_rules": {
    "punctuality_star": {
      "enabled": true,
      "condition": "status == 'PRESENT' and first_activity <= '09:00:00'"
    },
    "activity_star": {
      "enabled": true,
      "condition": "active_seconds >= 25200"
    }
  },
  "monitoring_rules": {
    "working_days": ["MON", "TUE", "WED", "THU", "FRI"],
    "screenshot_interval_minutes": 10,
    "monitoring_window_start": "09:00:00",
    "monitoring_window_end": "18:00:00",
    "compression_quality": 65,
    "max_dimension": [1280, 720]
  },
  "retention_rules": {
    "screenshot_retention_days": 30,
    "activity_retention_days": 90,
    "attendance_retention_days": 730
  }
}
```
