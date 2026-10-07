# System Architecture — Employee Tracking Platform

## 1. High-Level Architecture

```mermaid
flowchart TB
    subgraph ClientEndpoints["Employee Workstations (Windows)"]
        Agent["Rust Desktop Agent\n• Low-overhead Hook Aggregator\n• Screen Capture & WebP Compression\n• Local SQLite Queue & Retry Sync"]
    end

    subgraph Edge["Ingress & Gateway"]
        Nginx["Reverse Proxy / SSL Termination"]
    end

    subgraph BackendApp["Backend Tier (FastAPI)"]
        API["FastAPI Application Server"]
        AuthSvc["Auth & RBAC Middleware"]
        IngestSvc["Batch Ingestion Engine\n(Activity, Heatmap, Attendance)"]
        ScreenshotSvc["Screenshot Ingestion & Presigned URL Handler"]
        RuleSvc["Attendance & Star Rule Evaluator"]
        CleanupWorker["Retention Cleanup Background Worker"]
    end

    subgraph StorageTier["Data & Object Persistence"]
        PG[("PostgreSQL 16\n• Relational Data\n• Activity Time-series\n• Screenshot Metadata\n• Audit Logs")]
        S3[("S3-Compatible Object Storage (MinIO/AWS S3)\n• Compressed WebP Screenshots\n• Thumbnails")]
    end

    subgraph Frontend["Web Dashboard (React / SPA)"]
        AdminUI["Admin Portal\n(All Org, Rules, Retention, Devices, Audits)"]
        ManagerUI["Manager Portal\n(Scoped to Assigned Team)"]
        EmpUI["Employee Portal\n(Personal Attendance, Stats, Stars)"]
    end

    Agent -->|"HTTPS / Batch Sync + Heartbeat"| Nginx
    Frontend -->|"HTTPS / REST API"| Nginx
    Nginx --> API
    API --> AuthSvc
    API --> IngestSvc
    API --> ScreenshotSvc
    API --> RuleSvc
    API --> PG
    ScreenshotSvc --> S3
    CleanupWorker --> PG
    CleanupWorker --> S3
```

---

## 2. Component Breakdown & Technology Stack

| Layer | Technology | Rationale & Responsibility |
|---|---|---|
| **Desktop Agent** | **Rust (`windows-rs`, `image`, `rusqlite`, `reqwest`)** | Minimal CPU (<0.5%) and RAM (<35MB) footprint. Zero runtime dependency. Captures global OS input events as atomic counters only. Compresses screenshots to WebP locally. Offline-first SQLite persistence. |
| **Backend API** | **Python 3.12 + FastAPI + Pydantic v2 + SQLAlchemy (Asyncpg)** | High-concurrency async I/O for heartbeat/batch ingestion, auto-generated OpenAPI schemas, strict data validation, rapid maintenance. |
| **Relational Database** | **PostgreSQL 16** | Robust relational model for multi-tenant org hierarchy, indexed time-range queries for attendance/activity intervals, JSONB support for configurable rule engine gaps. |
| **Object Storage** | **MinIO / AWS S3 / Cloudflare R2** | Decouples binary image storage from relational DB. Stores immutable WebP binaries, serves temporary presigned URLs for UI preview. |
| **Task & Retention Worker** | **FastAPI Background Tasks / Celery or APScheduler** | Daily attendance finalization, star calculation, automated eviction of expired screenshots per retention policy. |
| **Web Dashboard** | **Modern SPA (React + TypeScript + TailwindCSS / Vanilla CSS)** | Role-tailored dashboards (Admin, Manager, Employee) with responsive tables, heatmap renderer, and virtualized screenshot galleries. |

---

## 3. Desktop Agent Architecture (Rust)

```mermaid
flowchart TD
    subgraph OS_Hooks["Windows OS Subsystem"]
        KHook["Raw Input / SetWindowsHookEx (Counters only)"]
        ScreenAPI["Windows Graphics Capture / GDI+"]
        PowerEvt["Session & Lock State Monitor"]
    end

    subgraph CoreEngine["Rust Agent Core (Async runtime / Tokio)"]
        Aggregator["Metrics Aggregator\n(5-Min window buffers)"]
        HeatmapProc["Mouse Grid Binning Engine (20x12 Grid)"]
        ImgPipeline["Image Pipeline:\nResize -> WebP Encoder (libwebp)"]
        QueueMgr["Local SQLite Buffer (`rusqlite`)"]
        SyncWorker["Background Uploader & Exponential Backoff Sync"]
    end

    subgraph Remote["Cloud / Server"]
        FastAPIServer["FastAPI Ingestion Endpoint"]
    end

    KHook -->|"Raw event pulses"| Aggregator
    PowerEvt -->|"Login / Unlock / Boot"| Aggregator
    ScreenAPI -->|"Scheduled Raw Frame"| ImgPipeline
    ImgPipeline -->|"Compressed WebP Buffer"| QueueMgr
    Aggregator -->|"5-min Batch Payload"| QueueMgr
    HeatmapProc -->|"Grid Matrix"| QueueMgr
    QueueMgr --> SyncWorker
    SyncWorker -->|"HTTPS POST (with Bearer Device Token)"| FastAPIServer
```

### Agent Reliability & Safety Constraints
1. **Zero Raw Keystroke Capture**: Hooks increment atomic integers (`AtomicU64`) only. No scan codes or virtual keys are inspected or stored in memory.
2. **Offline-First Resilience**: If the network is unavailable, events and compressed images are stored in a local encrypted SQLite database (`agent_store.db`).
3. **Queue Limit & Backpressure**: Max local queue capped at 500MB / 7 days of data. Oldest un-synced screenshots are dropped if storage threshold is exceeded to protect the employee host.
4. **Non-blocking Compression**: Screenshot compression runs on a background thread pool to ensure input tracking and OS responsiveness are never hitched.

---

## 4. Screenshot Pipeline & Object Storage Flow

```mermaid
sequenceDiagram
    autonumber
    participant Agent as Rust Agent
    participant SQLite as Local SQLite Queue
    participant API as FastAPI Backend
    participant DB as PostgreSQL
    participant S3 as Object Storage (S3/MinIO)
    participant UI as Dashboard Client

    Note over Agent: Schedule trigger (e.g. 10m interval during 09:00-18:00)
    Agent->>Agent: Capture desktop frame (1920x1080)
    Agent->>Agent: Resize to max bounds (e.g. 1280x720) & Compress to WebP (q=65)
    Agent->>SQLite: Persist screenshot record (blob, timestamp, device_id)
    
    Agent->>API: POST /api/v1/agent/screenshots/batch (multipart or presigned upload)
    API->>S3: PutObject(bucket, "screenshots/org/{emp_id}/{date}/{uuid}.webp")
    API->>DB: INSERT INTO screenshots (id, employee_id, device_id, s3_key, file_size, captured_at)
    API-->>Agent: 200 OK (Acknowledge IDs)
    Agent->>SQLite: DELETE processed items from local queue

    Note over UI: Manager / Admin views Screenshot Gallery
    UI->>API: GET /api/v1/screenshots?employee_id=123&date=2026-10-07&page=1
    API->>DB: Query metadata (paginated)
    API->>S3: Generate Presigned GET URLs (15m expiry)
    API-->>UI: Return metadata list with signed image URLs
    UI->>S3: Fetch WebP image directly via CDN/S3
```

---

## 5. Subsystem Boundaries & Security Architecture

### 5.1 Authentication & Multi-Tier Scope Isolation
- **Device Authentication**: Agents authenticate via mutual pre-shared Device Registration Tokens exchanging for rotating JWT Device Keys (`DEVICE_AGENT` scope).
- **User Authentication**: Standard OAuth2 Password / Bearer JWT with roles: `ADMIN`, `MANAGER`, `EMPLOYEE`.
- **Manager Scope Gate**: An enforced database-level predicate / repository middleware restricts all manager queries:
  $$\text{Query Filter: } \text{employee.manager\_id} = \text{current\_user.id}$$

### 5.2 Explicit V1 Boundaries
```mermaid
graph LR
    subgraph Allowed_V1["Included in V1"]
        A1[Periodic WebP Screenshot]
        A2[Keypress Count Summary]
        A3[Mouse Click & Move Counts]
        A4[20x12 Grid Activity Heatmap]
        A5[PC Boot / Login / Idle / Active Durations]
    end

    subgraph Forbidden_V1["Strictly Excluded from V1 Architecture"]
        F1[Live Video / Screen Streaming WebRTC]
        F2[Keylogger Text Buffers]
        F3[Clipboard Data Access]
        F4[Microphone / Audio Capture]
        F5[Webcam / Video Device Capture]
        F6[URL / Browser History Mining]
    end

    style Forbidden_V1 fill:#ffebee,stroke:#c62828,stroke-width:2px;
    style Allowed_V1 fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
```

---

## 6. Data Retention & Housekeeping Engine

```mermaid
flowchart TD
    Cron["Daily Maintenance Job (02:00 UTC)"] --> EvalRetention["Fetch Retention Policies from DB"]
    EvalRetention --> PurgeSS["Identify Screenshots where captured_at < (NOW - policy.screenshot_days)"]
    PurgeSS --> S3BatchDelete["Delete Objects from S3 Bucket in batches of 1,000"]
    S3BatchDelete --> DBDeleteSS["DELETE / Soft-delete metadata rows from PostgreSQL"]
    EvalRetention --> PurgeAct["Archive/Purge raw 5-min activity older than activity_days"]
    PurgeAct --> AuditLog["Log Retention Purge Event into audit_logs table"]
```

---

## 7. Scaling & Performance Characteristics

1. **Agent Footprint**: <0.5% CPU during regular monitoring, <3% CPU brief spike during WebP encoding (0.2s duration), ~30MB Resident RAM.
2. **Bandwidth Economy**: WebP compression reduces typical 1080p full screenshots from ~4MB (PNG) to ~45KB–90KB (WebP q=60-70). A 10-minute interval across an 8-hour workday consumes < 4MB network upload per employee per day.
3. **Database Indexing**: Composite indexes on `(employee_id, captured_at DESC)` and `(employee_id, date DESC)` guarantee fast sub-50ms dashboard page loads.
