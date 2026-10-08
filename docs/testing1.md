# REAL-TIME EMPLOYEE TRACKING DASHBOARD — FULL IMPLEMENTATION PROMPT

## Objective

The current application UI exists, but it is not displaying real live data consistently.

Your task is to convert the entire application from static/mock/demo data into a **fully functional real-time employee tracking dashboard** backed by the existing Supabase database and storage.

Do NOT redesign the application unnecessarily.

Do NOT create fake data to make the dashboard look populated.

Every visible metric, table, status, employee, screenshot, activity record, task, project, notification, filter, tab, subtab, and detail page must be connected to the actual backend data source.

The application must update automatically when backend data changes.

---

# 1. FIRST: AUDIT THE ENTIRE EXISTING APPLICATION

Before modifying code:

1. Inspect the complete repository.
2. Identify:

   * Frontend framework
   * Backend/API architecture
   * Supabase configuration
   * Database schema
   * Supabase Storage buckets
   * Authentication implementation
   * Existing employee agent
   * Existing dashboard components
   * Existing routes
   * Existing tabs/subtabs
   * Existing mock/static data
   * Existing API calls
   * Existing realtime subscriptions
3. Map every frontend screen to its backend data source.
4. Find every place where hardcoded/mock/demo data is being used.
5. Replace mock data with real data wherever the feature is supposed to be functional.

Do not delete existing functionality simply because it is incomplete.

Preserve the current UI/UX unless a change is required for functionality.

---

# 2. REAL-TIME ARCHITECTURE

Use Supabase as the source of truth.

The architecture should be:

Employee Agent
→ Authentication
→ Screenshot capture
→ Screenshot compression
→ Supabase Storage
→ Screenshot metadata in database
→ Supabase Realtime
→ Dashboard

For activity:

Employee Agent
→ Heartbeat/activity event
→ Supabase
→ Realtime
→ Dashboard

For tasks:

Dashboard
→ Database
→ Realtime
→ All authorized users

Never make the frontend responsible for inventing or calculating fake backend state.

---

# 3. AUTHENTICATION AND ROLES

Implement proper role-based access.

Supported roles:

```text
ADMIN
MANAGER
EMPLOYEE
```

The logged-in user's role must come from the authenticated user's backend profile.

Never determine permissions from frontend-only state.

## ADMIN

Admin can access organization-level data permitted by the system.

Admin should have access to:

* Overview
* Employees
* Managers
* Devices
* Screenshots
* Activity
* Tasks
* Projects
* Reports
* Settings
* Audit/log information where implemented

## MANAGER

Manager can only access:

* Employees assigned to that manager
* Their employees' screenshots
* Their employees' activity
* Their employees' tasks/projects
* Relevant reports

A manager must NOT be able to query or view unauthorized employees simply by manipulating URLs, IDs, or frontend requests.

## EMPLOYEE

Employee access should be restricted to employee-specific functionality.

Employees must NOT be able to access:

* Other employees' screenshots
* Other employees' activity
* Manager-only information
* Admin information
* Organization-wide private information

Use Supabase RLS as the actual security boundary.

Frontend hiding is NOT sufficient.

---

# 4. DASHBOARD OVERVIEW

Make every dashboard counter real.

Examples:

```text
Total Employees
Active Employees
Offline Employees
Screenshots Today
Tasks
Pending Tasks
Completed Tasks
Processing
To Do
```

These values must come from database queries.

Do not hardcode:

```text
12
8
4
152
```

unless those values actually exist in the database.

Counters should update when underlying records change.

---

# 5. REAL-TIME EMPLOYEE STATUS

Implement a reliable employee heartbeat system.

The agent should periodically update:

```text
last_seen
device_id
employee_id
status
```

The dashboard should calculate employee status from backend timestamps.

For example:

```text
ACTIVE
RECENTLY ACTIVE
OFFLINE
```

Use configurable thresholds.

Do not permanently store "online" as a manually maintained boolean unless there is a specific reason.

The authoritative signal should be `last_seen`.

When the agent sends a heartbeat:

```text
Agent
→ Supabase
→ Realtime
→ Dashboard updates employee status
```

The dashboard should not require a manual browser refresh.

---

# 6. EMPLOYEE TAB

The Employees page must display real employees.

Each employee row/card should show relevant backend data such as:

* Name
* Email/identifier
* Role
* Manager
* Department if available
* Device
* Current status
* Last seen
* Screenshot status
* Last screenshot
* Task status
* Created date

Implement:

* Search
* Filtering
* Sorting
* Pagination where required
* Employee detail view

All filters must query/filter actual backend data.

---

# 7. EMPLOYEE DETAIL PAGE

When opening an employee:

Display real information.

Recommended sections:

```text
Profile
Device
Current Status
Last Seen
Screenshot Activity
Activity Timeline
Tasks
Projects
Recent Events
```

Do not use placeholder values.

If information does not exist, display a proper empty state:

```text
No activity recorded yet.
```

Do not display fake activity.

---

# 8. SCREENSHOTS TAB

Connect the screenshot UI to Supabase Storage + screenshot metadata.

Each screenshot should have:

```text
id
employee_id
device_id
storage_path
captured_at
file_size
width
height
created_at
```

The dashboard must load the actual image from the authorized Storage location.

Display:

* Screenshot
* Employee
* Device
* Capture time
* Upload time if available
* File size
* Status

Implement:

* Latest screenshots
* Screenshot history
* Employee filter
* Date filter
* Time filter
* Search/filter where useful
* Screenshot detail viewer

---

# 9. SCREENSHOT REAL-TIME UPDATES

When an employee agent uploads a new screenshot:

```text
Agent
→ Storage upload
→ screenshot database INSERT
→ Supabase Realtime event
→ Dashboard receives event
→ New screenshot appears automatically
```

Do NOT require:

```text
F5
```

or:

```text
Refresh page
```

to see new screenshots.

Use Supabase Realtime subscriptions appropriately.

Ensure subscriptions are cleaned up when components unmount.

Do not create duplicate subscriptions.

---

# 10. SCREENSHOT INTERVAL

The screenshot system must respect the configured interval.

Example:

```text
1 minute
5 minutes
10 minutes
15 minutes
Custom interval
```

The actual agent should determine capture timing.

The dashboard should display the configured interval rather than pretending screenshots are being captured.

If the agent is not connected, clearly show:

```text
Agent offline
```

instead of generating fake screenshots.

---

# 11. SCREENSHOT COMPRESSION

Maintain the intended screenshot pipeline:

```text
Screen Capture
→ Resize if configured
→ Compress
→ Upload
→ Store metadata
```

Store compressed screenshots in Supabase Storage.

Do not store large raw screenshots unnecessarily.

Track:

```text
original_size
compressed_size
compression_ratio
```

where practical.

---

# 12. ACTIVITY TAB

Create a real employee activity timeline.

Activity should be generated from actual agent/backend events.

Examples:

```text
Agent started
Heartbeat received
Screenshot captured
Screenshot uploaded
Upload failed
Agent disconnected
Agent reconnected
Task started
Task completed
```

Do not create fake activity records.

Each event should contain appropriate metadata:

```text
employee_id
device_id
event_type
timestamp
metadata
```

The activity page must support:

* Employee filter
* Event-type filter
* Date/time filter
* Search where useful
* Latest activity
* Activity timeline

---

# 13. DEVICES TAB

Show real registered devices.

Display:

```text
Device
Employee
Operating System
Agent Version
Last Seen
Status
Last Screenshot
```

Possible statuses:

```text
ONLINE
OFFLINE
ERROR
UNKNOWN
```

Device information must come from the agent/backend.

---

# 14. TASKS TAB

Connect task management to the database.

Tasks should support:

```text
Title
Description
Employee
Manager
Project
Status
Priority
Due Date
Created At
Updated At
```

Statuses should include the project's defined statuses, for example:

```text
TO DO
PROCESSING
PENDING
DONE
NO LONGER NEEDED
```

Every status change must update the database.

Authorized users should see changes without manually refreshing.

---

# 15. PROJECTS TAB

Projects must be backed by actual database records.

Display:

```text
Project
Description
Manager
Employees
Task Count
Completed
Pending
Progress
Created At
Updated At
```

Project statistics must be calculated from real task data.

---

# 16. REPORTS

If the Reports section exists, connect it to actual data.

Possible metrics:

```text
Employee activity
Screenshot count
Active/offline time
Task completion
Task status distribution
Daily activity
Weekly activity
Monthly activity
```

Never present calculated metrics as real unless they are based on actual database records.

If insufficient data exists:

```text
Not enough data available.
```

---

# 17. WEEKLY AND MONTHLY UPDATES

Any existing:

```text
Weekly Update
Monthly Update
```

components must use actual database records.

For example:

```text
11/15
```

must represent an actual calculation.

Do not hardcode these values.

The date range must be calculated correctly.

Use the organization's configured timezone where appropriate.

---

# 18. NOTIFICATIONS

If notifications exist in the UI, connect them to actual backend events.

Examples:

```text
Employee went offline
Agent disconnected
Screenshot upload failed
Task assigned
Task completed
```

Notifications should have:

```text
id
user_id
type
title
message
read
created_at
```

Implement unread counts from the database.

---

# 19. SEARCH

Global and page-specific search must search actual records.

Do not search only currently hardcoded frontend arrays.

Search should respect authorization.

A manager searching for an employee must never receive employees outside their permitted scope.

---

# 20. FILTERS

Every filter must actually work.

Required examples:

```text
Employee
Manager
Status
Device
Date
Time
Task status
Project
Activity type
```

Changing a filter must update displayed data.

Do not create decorative filters that don't affect the underlying data.

---

# 21. TAB + SUBTAB BEHAVIOR

Audit EVERY tab and subtab in the existing application.

For every tab:

```text
TAB
 ├── Subtab
 ├── Filters
 ├── Search
 ├── Tables
 ├── Cards
 ├── Counters
 ├── Actions
 └── Detail pages
```

Verify that every visible element has a real purpose and backend connection.

No dead buttons.

No fake dropdowns.

No static counters.

No placeholder records.

No non-functional pagination.

No non-functional search.

No non-functional filters.

---

# 22. CRUD OPERATIONS

Where the application allows modifications, implement real CRUD.

Examples:

```text
Create employee
Update employee
Assign manager
Register device
Create task
Update task
Delete/archive task
Create project
Update project
```

Every mutation must:

```text
Validate input
→ Authorize user
→ Update Supabase
→ Handle errors
→ Update UI
→ Trigger realtime update where appropriate
```

---

# 23. REAL-TIME SUBSCRIPTIONS

Use Supabase Realtime for relevant tables.

At minimum consider subscriptions for:

```text
employees
devices
screenshots
employee_activity
tasks
projects
notifications
```

Only subscribe where realtime behavior is actually useful.

Avoid subscribing every component independently to the same data.

Prefer centralized data/realtime management where appropriate.

Ensure:

```text
subscribe
→ receive events
→ update state/cache
→ unsubscribe on cleanup
```

No memory leaks.

No duplicate events.

No duplicate records in UI.

---

# 24. DATA FETCHING

Implement a proper data layer.

Do not scatter random Supabase queries throughout every UI component.

Use a consistent architecture such as:

```text
UI
 ↓
Hooks / State
 ↓
Service / Repository
 ↓
Supabase
```

Example:

```text
employeeService
screenshotService
activityService
taskService
projectService
deviceService
notificationService
```

This makes the application easier to maintain.

---

# 25. LOADING STATES

Every data-driven page needs proper loading states.

Examples:

```text
Loading employees...
Loading screenshots...
Loading activity...
```

Do not show fake data while loading.

---

# 26. EMPTY STATES

If there is no backend data, show a useful empty state.

Examples:

```text
No employees found.
No screenshots available.
No activity recorded.
No tasks found.
No devices registered.
```

Do not populate empty pages with demo data.

---

# 27. ERROR STATES

Handle:

```text
Supabase unavailable
Network failure
Unauthorized
Expired session
Storage failure
Realtime disconnected
Invalid data
Upload failure
```

Show useful error messages.

Do not silently fail.

---

# 28. REALTIME CONNECTION STATUS

The dashboard should know whether its realtime connection is healthy.

Display an appropriate subtle indicator such as:

```text
Live
Reconnecting...
Offline
```

If realtime disconnects:

1. Attempt reconnect.
2. Do not crash the dashboard.
3. Re-sync relevant data after reconnecting.

---

# 29. DATA CONSISTENCY

Realtime events must not blindly append duplicate records.

Example:

If screenshot `123` already exists and the same realtime event arrives again:

```text
Do not display screenshot 123 twice.
```

Use stable database IDs.

Likewise for:

* Employees
* Tasks
* Activity
* Devices
* Notifications

---

# 30. SECURITY

IMPORTANT.

Never expose privileged Supabase credentials in the frontend or employee agent.

Never place:

```text
SUPABASE_SERVICE_ROLE_KEY
```

in browser-accessible code.

Use appropriate public/anon credentials with RLS where applicable.

All sensitive operations must be protected by backend authorization.

Storage access must also respect authorization.

Do not assume that hiding a UI element provides security.

---

# 31. AGENT AUTHENTICATION

The employee agent must have a secure identity.

The backend must know:

```text
Which organization?
Which employee?
Which device?
```

Do not trust arbitrary employee IDs supplied by the client.

Prevent one device from impersonating another employee.

Design the authentication flow so that credentials/tokens can be revoked.

---

# 32. OFFLINE/NETWORK FAILURE

The agent must tolerate temporary network failures.

When Supabase is unavailable:

```text
Capture
→ Compress
→ Queue locally
→ Retry
→ Upload when connection returns
```

Do not lose screenshots unnecessarily.

Do not upload the same screenshot multiple times.

The dashboard should accurately show the last successful communication.

---

# 33. DASHBOARD AUTO-SYNC

The dashboard should:

1. Fetch initial state.
2. Establish realtime subscriptions.
3. Receive changes.
4. Update affected UI.
5. Periodically reconcile with backend where appropriate.
6. Reconnect after realtime failures.

Do not depend exclusively on WebSocket events for long-term consistency.

Realtime + reconciliation should be used where appropriate.

---

# 34. DATE/TIME HANDLING

Store timestamps consistently.

Prefer UTC in the database.

Convert timestamps for display using the configured organization/user timezone.

Correctly handle:

```text
Today
Yesterday
This week
This month
Custom date range
```

Do not compare timestamps using unreliable string manipulation.

---

# 35. PERFORMANCE

Do not load thousands of screenshots at once.

Use:

```text
Pagination
Cursor pagination where appropriate
Lazy loading
Efficient queries
Indexes
Thumbnail/optimized image strategy
```

For screenshot galleries, load thumbnails first and full-resolution images only when opened.

---

# 36. DATABASE INDEXING

Review indexes for frequently queried fields.

Consider indexes around:

```text
employee_id
manager_id
organization_id
device_id
captured_at
last_seen
status
created_at
project_id
task status
```

Only add indexes that support actual query patterns.

---

# 37. AUDIT THE UI FOR FAKE DATA

Search the repository for:

```text
mock
dummy
demo
sample
fake
hardcoded
placeholder
static
```

Also inspect:

```text
const employees = [...]
const screenshots = [...]
const activities = [...]
const tasks = [...]
```

Remove/replace these where they represent production application data.

Keep static configuration/constants only when they are genuinely configuration.

---

# 38. NO SILENT FALLBACK TO MOCK DATA

This is critical.

If Supabase fails:

DO NOT do:

```text
Supabase failed
→ show demo employees
```

Instead:

```text
Supabase failed
→ show error/reconnect state
```

The application must always make it obvious whether displayed data is real.

---

# 39. REAL-TIME TESTING

Create a test plan.

### Test A — Screenshot

```text
Start agent
→ Capture screenshot
→ Upload
→ Database record created
→ Dashboard receives event
→ Screenshot appears
```

### Test B — Heartbeat

```text
Start agent
→ Heartbeat
→ Dashboard shows Online
```

Stop agent:

```text
Agent stops
→ heartbeat expires
→ Dashboard shows Offline
```

### Test C — Task

```text
Manager creates task
→ Employee dashboard receives task
```

Employee changes status:

```text
Employee
→ Update
→ Database
→ Manager dashboard updates
```

### Test D — Permissions

```text
Manager A
→ Employee A visible

Manager A
→ Employee B from Manager B
→ NOT visible
```

### Test E — Realtime reconnect

```text
Dashboard online
→ Realtime disconnect
→ Reconnecting state
→ Connection restored
→ Data resynchronized
```

---

# 40. ACCEPTANCE CRITERIA

The implementation is NOT complete until:

* [ ] No production dashboard data is hardcoded
* [ ] Employees come from Supabase
* [ ] Devices come from Supabase
* [ ] Screenshots come from Supabase Storage
* [ ] Screenshot metadata comes from Supabase
* [ ] Activity comes from Supabase
* [ ] Tasks come from Supabase
* [ ] Projects come from Supabase
* [ ] Notifications come from Supabase
* [ ] Admin permissions work
* [ ] Manager permissions work
* [ ] Employee permissions work
* [ ] RLS protects all sensitive tables
* [ ] Storage permissions are enforced
* [ ] New screenshots appear without page refresh
* [ ] Employee online/offline state updates automatically
* [ ] Task changes update automatically
* [ ] Activity changes update automatically
* [ ] Realtime reconnect works
* [ ] Failed requests show errors
* [ ] Loading states work
* [ ] Empty states work
* [ ] Search works
* [ ] Filters work
* [ ] Pagination works
* [ ] Detail pages use real data
* [ ] No fake fallback data is displayed
* [ ] Duplicate realtime events are handled
* [ ] Agent network failures are handled
* [ ] Screenshot upload retries work
* [ ] Timestamp handling is correct
* [ ] No service-role key is exposed
* [ ] No unauthorized user can access restricted records

---

# 41. IMPORTANT DEVELOPMENT RULES

Do NOT:

* Rebuild the entire UI from scratch.
* Replace working components unnecessarily.
* Add mock data.
* Pretend a feature is realtime when it isn't.
* Add fake activity.
* Add fake screenshots.
* Hardcode dashboard numbers.
* Bypass RLS.
* Put privileged credentials in the frontend.
* Create decorative buttons that don't work.
* Implement only the main dashboard while leaving subtabs disconnected.

DO:

* Inspect first.
* Reuse existing architecture.
* Connect every existing screen to real backend data.
* Implement missing backend functionality where necessary.
* Keep the UI consistent.
* Use real Supabase data.
* Use Supabase Realtime where appropriate.
* Handle loading, empty, error, offline, and reconnect states.
* Test every role.
* Test every tab.
* Test every subtab.
* Test every important action.

---

# 42. FINAL DELIVERABLE

After implementation, provide a concise technical report containing:

```text
1. What was already implemented
2. What was changed
3. Database tables used
4. Realtime subscriptions implemented
5. RLS policies verified
6. Storage policies verified
7. Agent → Supabase flow
8. Dashboard → Supabase flow
9. Roles and permissions
10. Tabs/subtabs connected
11. Mock data removed
12. Tests performed
13. Known issues
14. Remaining work
```

Do not claim something is working unless you actually tested it.

The final result must be a **real, backend-connected, realtime employee tracking dashboard**, not a static UI prototype.

Because your current problem is specifically “the app isn't giving me live data,” tell the coding agent to work in this order:

Backend/data audit → Supabase connection → authentication/RLS → agent heartbeat → screenshot upload → Realtime → dashboard queries → every tab/subtab → testing.