# Windows Employee Monitoring Agent — Development Phases

## Project Goal

Build a lightweight Windows-native Employee Monitoring Agent in Rust.

The agent runs on authorized employee Windows devices and provides the backend with reliable monitoring data for the Employee Tracking Dashboard.

The complete agent will eventually support:

- Employee/device identity
- Active/idle detection
- Mouse activity indicators
- Keyboard activity indicators
- Activity timestamps
- Screenshot capture
- Screenshot compression
- Screenshot upload
- Offline queueing
- Supabase communication
- Remote configuration
- Secure authentication
- Health/status reporting
- Automatic startup/background execution
- Resource-efficient operation

The agent must be built incrementally.

Do not build everything at once.

---

# Phase 0 — Repository and Architecture Inspection

## Objective

Understand the existing application before creating the agent.

## Tasks

Inspect:

- Existing frontend
- Existing backend
- Existing Supabase configuration
- Existing authentication
- Existing employee/user model
- Existing role system
- Existing database schema
- Existing screenshot functionality
- Existing activity functionality
- Existing API structure
- Existing environment variables
- Existing project structure

Determine:

- Where the Rust agent should live
- How the agent will authenticate
- How an employee is associated with a device
- How Supabase will receive agent data
- Which existing tables can be reused
- Which new tables are required
- Which existing functionality must not be duplicated

## Deliverable

Produce an internal implementation plan before modifying the codebase.

Do not delete or replace existing Employee dashboard functionality.

---

# Phase 1 — Rust Agent Foundation

## Objective

Create the base Windows Rust agent.

## Structure

Use a maintainable structure similar to:

```text
agent/
├── Cargo.toml
├── README.md
└── src/
    ├── main.rs
    ├── config/
    ├── activity/
    ├── presence/
    ├── windows/
    ├── supabase/
    ├── auth/
    ├── screenshots/
    ├── storage/
    ├── uploader/
    ├── health/
    └── errors/


Phase 2 — Agent Configuration

SUPABASE_URL
SUPABASE_ANON_KEY
AGENT_ID
DEVICE_ID
EMPLOYEE_ID
ACTIVITY_INTERVAL
IDLE_THRESHOLD
SCREENSHOT_INTERVAL
SCREENSHOT_QUALITY
MAX_LOCAL_QUEUE_SIZE
LOG_LEVEL

Do not hardcode secrets.

Separate:

Public configuration
Device configuration
Authentication credentials
Runtime settings
Requirements

The agent must validate configuration during startup.

Invalid configuration should produce a clear error rather than silently failing.

Deliverable

A reusable configuration module.

Phase 3 — Device Identity
Objective

Give each installed agent a stable device identity.

Requirements

The agent must be able to identify:

Device ID
Employee ID
Agent version
Operating system
Agent installation/version information
Last heartbeat

Do not use easily changing values as the primary device identity.

The device must be associated with the correct employee through the application's authentication/onboarding system.

Do not hardcode employee IDs.

Deliverable

A device identity module that can persist and retrieve the agent's identity.

Phase 4 — Secure Agent Authentication
Objective

Authenticate the agent securely with the backend/Supabase.

Requirements

Implement:

Device registration
Employee/device association
Authentication
Token/session handling
Token refresh where required
Secure credential storage where appropriate
Authorization validation

Never expose:

Service-role keys
Administrative secrets
Database passwords
Privileged backend credentials

inside the Windows agent.

Security

The agent should only be able to perform actions permitted for its authenticated identity.

Deliverable

Authenticated Agent → Supabase communication.

Phase 5 — Windows Activity Detection
Objective

Implement the core activity detector.

The agent should detect activity indicators without recording the actual contents of user keystrokes.

Track:

Mouse movement/activity
Mouse clicks where appropriate
Keyboard activity events without storing typed content
Last activity timestamp

Do not create a keylogger.

Do not store:

Typed characters
Passwords
Message contents
Form input contents
Deliverable

A Windows activity module that exposes:

last_activity_at
last_mouse_activity
last_keyboard_activity

Phase 6 — Active / Idle Detection
Objective

Convert activity events into reliable employee presence states.

Initial states:

ACTIVE
IDLE
OFFLINE

Optional future states:

ON_BREAK
LOCKED
SUSPENDED
Logic

Example:

Activity detected
      ↓
ACTIVE

No meaningful activity for configured threshold
      ↓
IDLE

Agent unavailable / heartbeat lost
      ↓
OFFLINE

The idle threshold must be configurable.

Example:

Idle threshold = 5 minutes

Do not hardcode this permanently.

Deliverable

Reliable state transitions:

ACTIVE → IDLE
IDLE → ACTIVE
ACTIVE → OFFLINE
IDLE → OFFLINE
OFFLINE → ACTIVE
Phase 7 — Local Activity Event Model
Objective

Create a local representation of activity events before uploading them.

Example:

ActivityEvent

id
employee_id
device_id
event_type
occurred_at
metadata
created_at

Possible event types:

ACTIVE
IDLE_STARTED
ACTIVE_RESUMED
MOUSE_ACTIVITY
KEYBOARD_ACTIVITY
AGENT_STARTED
AGENT_STOPPED

Avoid generating excessive database writes for every mouse movement or keyboard event.

Aggregate activity where appropriate.

Deliverable

A normalized activity event system.

Phase 8 — Local Persistence and Queue
Objective

Prevent monitoring data from being lost when the network is unavailable.

The agent should maintain a local queue for unsent data.

Requirements

When:

Internet available

send data normally.

When:

Internet unavailable

store pending events locally.

When connectivity returns:

Local Queue
     ↓
Upload
     ↓
Successful
     ↓
Remove from Queue
Requirements

Handle:

Queue limits
Retry attempts
Backoff
Duplicate prevention
Corrupted queue data
Application restart

Never allow an unlimited local queue.

Deliverable

Reliable offline-first event buffering.

Phase 9 — Supabase Activity Pipeline
Objective

Send activity information to Supabase.

Create or adapt the required database structures.

Suggested conceptual tables:

employee_presence
activity_events
agent_devices
employee_presence
id
employee_id
device_id
status
last_activity_at
idle_since
last_heartbeat_at
updated_at
activity_events
id
employee_id
device_id
event_type
occurred_at
metadata
created_at
agent_devices
id
employee_id
device_name
agent_version
platform
last_seen_at
status
created_at
updated_at

Use appropriate:

Primary keys
Foreign keys
Indexes
Constraints
Timestamps
Deliverable

Working:

Rust Agent
     ↓
Supabase

activity pipeline.

Phase 10 — Row Level Security
Objective

Secure monitoring data at the database/API layer.

Never rely exclusively on frontend restrictions.

Requirements

Employee:

Own device
↓
Own activity
↓
Own presence

Manager:

Assigned teams
↓
Assigned employees
↓
Authorized activity

Admin:

Organization
↓
All authorized employees

RLS policies must prevent unauthorized access even if a user manually modifies IDs or API requests.

Deliverable

Tested Supabase RLS policies.

Phase 11 — Agent Heartbeat
Objective

Determine whether an agent is currently connected.

The agent should periodically send a heartbeat.

Example:

heartbeat
employee_id
device_id
agent_version
timestamp
status

Heartbeat should be lightweight.

Example flow:

Agent
  ↓
Heartbeat
  ↓
Supabase
  ↓
last_seen_at updated

If heartbeat stops beyond a configured timeout:

Agent unavailable

The backend can then determine the employee/device as offline.

Deliverable

Reliable online/offline detection.

Phase 12 — Screenshot Capture
Objective

Add authorized periodic screenshot capture.

The screenshot system should be configurable.

Settings:

Screenshot enabled
Screenshot interval
Screenshot quality
Maximum dimensions

Example:

5 minutes

The interval must come from configuration rather than being permanently hardcoded.

Requirements

Capture screenshots using an appropriate Windows-compatible Rust implementation.

Do not capture continuously unless explicitly required.

Do not store screenshots indefinitely on the local machine.

Deliverable

Working screenshot capture module.

Phase 13 — Screenshot Processing
Objective

Reduce screenshot size before upload.

Pipeline:

Screen
  ↓
Capture
  ↓
Resize if required
  ↓
Compress
  ↓
Validate
  ↓
Queue
  ↓
Upload
Requirements

Support configurable:

JPEG/WebP quality where appropriate
Maximum resolution
Compression quality
File-size limits

The original uncompressed image should not be retained unnecessarily.

Deliverable

Compressed screenshot files ready for upload.

Phase 14 — Screenshot Metadata
Objective

Associate each screenshot with the correct employee/device/time.

Metadata should include:

id
employee_id
device_id
captured_at
storage_path
file_size
width
height
quality
activity_state
created_at

Optional:

task_id
project_id
monitoring_session_id

Only add optional relationships if the existing application supports them.

Deliverable

A complete screenshot metadata model.

Phase 15 — Screenshot Storage
Objective

Upload compressed screenshots to the application's authorized storage system.

Preferred architecture:

Rust Agent
     ↓
Compress
     ↓
Upload
     ↓
Supabase Storage
     ↓
Metadata record

Do not store large screenshot binaries directly inside relational tables unless the existing architecture specifically requires it.

Use structured storage paths.

Example:

screenshots/
  organization/
    employee/
      date/
        timestamp.jpg

Do not expose storage objects publicly.

Use authorized access.

Deliverable

Working screenshot upload pipeline.

Phase 16 — Screenshot Offline Queue
Objective

Prevent screenshot loss during temporary connectivity problems.

Pipeline:

Screenshot
    ↓
Compress
    ↓
Local Queue
    ↓
Internet Available?
    │
    ├── YES → Upload
    │
    └── NO  → Keep Local
                   ↓
              Retry Later

Requirements:

Maximum queue size
Retry policy
Backoff
Duplicate prevention
Cleanup after successful upload
Failed upload handling
Deliverable

Reliable screenshot delivery.

Phase 17 — Remote Configuration
Objective

Allow Admin-controlled monitoring configuration.

Potential configuration:

Screenshot interval
Screenshot quality
Idle threshold
Keyboard activity enabled
Mouse activity enabled
Screenshot monitoring enabled
Data retention

Architecture:

Admin Dashboard
       ↓
Supabase
       ↓
Agent Configuration
       ↓
Rust Agent

The agent should periodically check for configuration updates.

Do not require an agent restart for every configuration change unless technically necessary.

Deliverable

Remote configuration synchronization.

Phase 18 — Agent Health Monitoring
Objective

Allow the backend to determine whether an agent is healthy.

Track:

Agent version
Last heartbeat
Last activity upload
Last screenshot upload
Queue size
Last error
Current status

Possible states:

HEALTHY
WARNING
OFFLINE
ERROR
OUTDATED
Deliverable

Agent health information available to the backend.

Phase 19 — Resource Optimization
Objective

Keep the agent lightweight.

Optimize:

CPU usage
RAM usage
Network usage
Disk usage
Screenshot processing
Database writes
Event frequency

Avoid:

Constant polling at very short intervals
Writing every mouse movement to the database
Writing every keyboard event to the database
Uncompressed screenshot uploads
Unlimited local queues
Memory growth over time

Use aggregation and batching where appropriate.

Deliverable

A lightweight Windows monitoring agent.

Phase 20 — Windows Background Execution
Objective

Allow the agent to operate reliably as a Windows background application/service according to the organization's device-management policy.

Requirements:

Start according to configured deployment policy
Continue running after normal application closure
Recover from non-fatal errors
Restart safely after system reboot where authorized
Log startup/shutdown events
Avoid duplicate agent instances

Do not implement stealth or anti-detection behavior.

The agent should operate under the organization's documented employee-monitoring policy.

Deliverable

Reliable background execution on Windows.

Phase 21 — Agent Update System
Objective

Prepare the agent for future version updates.

Agent should expose:

agent_version

Backend should be able to determine:

Current Version
Required Version
Update Available

Future update flow:

Backend
   ↓
New Version
   ↓
Agent Update
   ↓
Verify Installation
   ↓
Restart Agent

Do not implement a complicated auto-updater until the core agent is stable.

Deliverable

Version-aware agent architecture.

Phase 22 — Error Handling and Logging
Objective

Make the agent diagnosable.

Log:

Agent started
Agent stopped
Authentication success/failure
Supabase connection
Heartbeat
Activity detection errors
Screenshot errors
Compression errors
Upload errors
Queue errors
Configuration changes

Never log:

Passwords
Authentication secrets
Actual keyboard input
Sensitive screenshot contents
Access tokens

Support log levels:

ERROR
WARN
INFO
DEBUG
Deliverable

Production-quality structured logging.

Phase 23 — Security Hardening
Objective

Secure the Windows agent and its communication.

Implement:

HTTPS/TLS communication
Secure authentication
Token protection
Input validation
Secure local storage
Minimal permissions
RLS
Backend authorization
Request validation
Upload validation
File-size limits
Queue limits

Do not embed privileged Supabase credentials inside the agent.

Do not create hidden backdoors.

Do not bypass Windows security controls.

Deliverable

Security-reviewed agent architecture.

Phase 24 — Agent Testing
Objective

Test every subsystem independently.

Activity Tests

Test:

Active
↓
Idle

Idle
↓
Active

Active
↓
Offline

Offline
↓
Active
Screenshot Tests

Verify:

Screenshot capture
Compression
Metadata
Upload
Retry
Duplicate prevention
Cleanup
Network Tests

Simulate:

Internet available
Internet unavailable
Internet restored
Supabase unavailable
Slow network
Authentication failure
Storage Tests

Test:

Queue empty
Queue contains events
Queue contains screenshots
Queue reaches limit
Agent restarts
System restarts
Security Tests

Attempt:

Employee A → Employee B data
Manager A → Manager B data
Manager → Admin data
Employee → Manager data
Employee → Admin data

All unauthorized access must fail.

Phase 25 — Windows Compatibility Testing
Objective

Verify the agent on supported Windows environments.

Test:

Windows 10
Windows 11

Verify:

Startup
Activity detection
Idle detection
Screenshot capture
Compression
Upload
Reconnection
Resource usage
Restart behavior

Test different:

Screen resolutions
Display scaling
Single-monitor systems
Multi-monitor systems
Phase 26 — Performance Testing
Objective

Ensure the agent remains lightweight during long-running operation.

Measure:

CPU usage
RAM usage
Disk usage
Network usage
Screenshot processing time
Upload time
Queue size
Database writes

Test for:

1 hour
8 hours
24 hours

Look for:

Memory leaks
CPU spikes
Queue growth
Excessive network traffic
Excessive database writes
Screenshot accumulation
Phase 27 — Supabase Integration Validation
Objective

Verify the complete backend pipeline.

Final flow:

Windows Employee PC
        │
        ▼
Rust Agent
        │
        ├── Activity
        ├── Presence
        ├── Heartbeat
        └── Screenshot
                │
                ▼
        Local Compression/Queue
                │
                ▼
             Supabase
                │
        ┌───────┴────────┐
        ▼                ▼
Admin Dashboard    Manager Dashboard

Verify:

Correct employee
Correct device
Correct timestamp
Correct status
Correct screenshot
Correct authorization
Correct storage
Correct retry behavior
Phase 28 — Admin/Manager Data Integration
Objective

Only after the agent pipeline is stable, connect the dashboards.

Admin should consume:

All authorized organization activity
All authorized employee presence
Screenshots
Attendance data
Agent health

Manager should consume:

Assigned employee activity
Assigned employee presence
Assigned employee screenshots
Assigned attendance
Assigned agent health

The frontend must never bypass backend authorization.

Phase 29 — Real-Time Monitoring
Objective

Add real-time employee status updates after the agent is proven stable.

Architecture:

Rust Agent
     ↓
Supabase
     ↓
Realtime
     ↓
Admin / Manager Dashboard

Examples:

Employee becomes Active
        ↓
Dashboard updates

Employee becomes Idle
        ↓
Dashboard updates

Agent goes Offline
        ↓
Dashboard updates

Avoid excessive real-time events.

Only publish meaningful state changes and required updates.

Phase 30 — Final Agent Packaging
Objective

Prepare the agent for actual internal distribution.

Create:

Agent executable
Configuration
Version information
Logging
Installation process
Uninstallation process
Documentation

The installation process should:

Install the agent
Register the device
Associate the employee
Configure the agent
Start the agent
Verify connectivity

Do not deploy publicly until security and authorization testing is complete.

Phase 31 — Final Acceptance Criteria

The Rust Windows Employee Monitoring Agent is considered complete when:

Identity
Device has a stable identity.
Employee/device association works.
Agent version is reported.
Activity
Active state works.
Idle state works.
Idle threshold is configurable.
Activity timestamps are accurate.
Actual typed content is never stored.
Presence
Active status works.
Idle status works.
Offline status works.
Heartbeat works.
Screenshots
Screenshots can be captured.
Screenshots are compressed.
Metadata is recorded.
Screenshots are uploaded.
Failed uploads are retried.
Full-resolution images are not unnecessarily retained locally.
Connectivity
Agent works during temporary network failure.
Data is queued locally.
Data uploads after reconnection.
Duplicate records are prevented.
Security
No privileged backend credentials are embedded.
Authentication works.
RLS works.
Backend authorization works.
Unauthorized data access fails.
Performance
CPU usage remains low.
RAM usage remains stable.
Network usage is reasonable.
Database writes are controlled.
Long-running operation does not cause memory/queue growth.
Windows
Agent works on supported Windows versions.
Agent handles restart.
Agent handles network reconnection.
Agent handles normal errors.
Agent runs reliably according to the organization's device-management policy.
Dashboard Integration
Employee Windows Agent
        ↓
Supabase
        ↓
Admin Dashboard
        ↓
Manager Dashboard

All displayed monitoring data must originate from the real agent/backend pipeline.


Critical Development Rule

Do not implement all phases in one step.

Complete each phase, verify it works, and only then continue to the next phase.

At every phase:

Inspect existing code.
Reuse existing architecture where possible.
Make the smallest safe changes.
Test the change.
Report what was changed.
Do not break the Employee dashboard.
Do not commit automatically.
Do not deploy automatically.