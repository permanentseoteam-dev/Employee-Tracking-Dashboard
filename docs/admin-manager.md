You are working on an existing Employee Tracking Dashboard application.

IMPORTANT:
The application already has an Employee role dashboard.

Your task is NOT to redesign, replace, remove, or downgrade the existing Employee dashboard.

The current issue is that the application primarily supports the Employee experience while the Admin and Manager experiences are missing or insufficient.

Your job is to implement TWO completely separate role-specific experiences:

1. ADMIN DASHBOARD
2. MANAGER DASHBOARD

The existing EMPLOYEE DASHBOARD must continue working exactly as it currently does.

==================================================
1. FIRST: INSPECT THE EXISTING CODEBASE
==================================================

Before making ANY code changes:

1. Inspect the complete project structure.
2. Identify the frontend framework and architecture.
3. Identify the backend architecture.
4. Identify the current authentication system.
5. Identify how user roles are stored and checked.
6. Identify the existing Employee dashboard route.
7. Identify reusable UI components.
8. Identify existing API endpoints.
9. Identify existing database models/schema.
10. Identify employee, task, project, attendance, monitoring, screenshot, and activity data structures.
11. Identify existing routing and middleware.
12. Identify existing design system, colors, typography, spacing, components, and layout patterns.

Do not immediately start generating new UI.

First understand how the existing application works.

Do not duplicate functionality that already exists if it can safely be reused.

==================================================
2. NON-DESTRUCTIVE DEVELOPMENT RULE
==================================================

DO NOT:

- Delete existing Employee functionality.
- Replace the Employee dashboard.
- Rewrite working Employee components unnecessarily.
- Break existing authentication.
- Break existing APIs.
- Remove existing database fields.
- Replace existing data models without a migration strategy.
- Create fake functionality just to make the UI look complete.
- Hardcode fake employee statistics.
- Create decorative charts with meaningless numbers.
- Hide Admin/Manager functionality only through frontend navigation.

Before changing an existing component, determine whether it is shared by Employee functionality.

If a shared component is modified, verify that the Employee dashboard still works afterward.

If there is uncertainty about a destructive change, STOP and ask for permission before making it.

==================================================
3. ROLE ARCHITECTURE
==================================================

The application must support three distinct roles:

ADMIN
↓
Organization-wide management

MANAGER
↓
Assigned team management

EMPLOYEE
↓
Personal work/productivity

The hierarchy is:

ADMIN
  ├── Managers
  │     └── Assigned Teams
  │           └── Employees
  │                 ├── Tasks
  │                 └── Projects
  │
  └── Organization-wide data

MANAGER
  └── Assigned Teams
        └── Assigned Employees
              ├── Tasks
              └── Projects

EMPLOYEE
  └── Own data

Never allow Manager permissions to become equivalent to Admin permissions.

==================================================
4. ROLE-BASED ROUTING
==================================================

Create separate dashboard routes:

/admin/dashboard
/manager/dashboard
/employee/dashboard

After authentication:

ADMIN
→ /admin/dashboard

MANAGER
→ /manager/dashboard

EMPLOYEE
→ /employee/dashboard

If a user manually attempts to access an unauthorized route:

Example:

Manager → /admin/dashboard

The backend must reject the request.

Return either:

403 Forbidden

or redirect to the user's authorized dashboard.

Do NOT rely only on frontend route protection.

==================================================
5. BACKEND PERMISSION ENFORCEMENT
==================================================

This is critical.

Permissions must be enforced at the backend/API/database query level.

Never:

1. Fetch all employees.
2. Send all employees to the frontend.
3. Filter unauthorized employees using frontend JavaScript.

Instead, the backend must only return data the authenticated user is authorized to access.

ADMIN:

Organization
→ All Teams
→ All Employees

MANAGER:

Manager
→ Assigned Teams
→ Assigned Employees

EMPLOYEE:

Employee
→ Own Data

Managers must NEVER be able to access employees outside their assigned scope by manipulating URLs, IDs, API requests, or frontend state.

==================================================
6. ADMIN EXPERIENCE
==================================================

Build a dedicated Admin Dashboard.

The Admin dashboard should feel like an:

"Organization Control Center"

It should NOT look like the Employee dashboard.

The Admin should immediately see:

- Total employees
- Online employees
- Offline employees
- Late employees
- Idle employees
- Active tasks
- Completed tasks
- Attendance
- Activity indicators
- Project progress
- Monitoring system status

==================================================
7. ADMIN SIDEBAR
==================================================

Create:

Dashboard

Organization
- Employees
- Managers
- Teams
- Departments

Monitoring
- Live Activity
- Screenshots
- Activity Analytics
- Heatmaps

Attendance
- Overview
- Daily Attendance
- Late Arrivals
- Attendance Rules
- Attendance Reports

Projects
- All Projects
- Active Projects
- Completed Projects
- Project Settings

Tasks
- All Tasks
- In Progress
- Completed
- Overdue

Performance
- Overview
- Employee Performance
- Team Performance
- Stars

Documents
- Google Sheets
- Google Docs

Reports

Settings
- Organization
- Monitoring
- Attendance
- Performance
- Roles & Permissions
- Integrations
- Security

Audit Logs

Sidebar requirements:

- Collapsible.
- Responsive.
- Icon-only mode when collapsed.
- Tooltips when collapsed.
- Active navigation state.
- Do not show Admin navigation to Manager or Employee.

==================================================
8. ADMIN TOP BAR
==================================================

Include:

- Organization selector
- Global search
- Notifications
- System status
- Admin profile

==================================================
9. ADMIN KPI CARDS
==================================================

Create organization-level KPI cards:

- Total Employees
- Online Now
- Late Today
- Currently Idle
- Active Tasks
- Completed Tasks
- Projects
- Attendance Rate

Every KPI must use real application data.

Do NOT use decorative hardcoded values.

==================================================
10. ADMIN ATTENDANCE
==================================================

Create an organization-wide attendance section.

Display:

- Attendance Rate
- On Time
- Late
- Absent
- On Leave

Add attendance trend visualization.

Filters:

- Today
- This Week
- This Month
- Custom Range
- Department
- Team
- Manager

==================================================
11. ADMIN EMPLOYEE MONITORING
==================================================

Create a live employee-status table.

Columns:

- Employee
- Team
- Manager
- Status
- Attendance
- First Activity
- Active Time
- Idle Time
- Last Screenshot
- Current Task
- Stars

Statuses:

- Active
- Idle
- Offline
- On Break

Clicking an employee should open their detailed employee monitoring page.

==================================================
12. ADMIN EMPLOYEE DETAIL
==================================================

Create:

Employee Overview

Tabs:

- Overview
- Attendance
- Activity
- Screenshots
- Mouse Heatmap
- Tasks
- Performance
- Stars

Display:

- Name
- Role
- Department
- Manager
- Current Status
- Attendance

==================================================
13. ADMIN SCREENSHOT MANAGEMENT
==================================================

Create:

Monitoring → Screenshots

Admin can:

- Select employee
- Select date
- Select time range
- View screenshot timeline
- View screenshot grid
- Open screenshot
- View capture timestamp
- Filter by activity state

Use thumbnail previews.

Do not load full-resolution screenshots until the user opens a screenshot.

Respect the existing screenshot storage/compression system.

Do not invent a new screenshot storage system if one already exists.

==================================================
14. ADMIN ACTIVITY ANALYTICS
==================================================

Create organization-wide activity analytics.

Display:

- Active Time
- Idle Time
- Keyboard Activity
- Mouse Activity

Allow:

- Daily
- Weekly
- Monthly

Filters:

- Employee
- Team
- Department
- Manager
- Date

IMPORTANT:

Do not label raw keyboard/mouse activity as an unquestionable "productivity score".

Present these as activity indicators.

==================================================
15. ADMIN HEATMAP
==================================================

Create:

Monitoring → Heatmaps

Allow:

- Employee
- Date
- Time range

Modes:

- Movement
- Clicks
- Combined

Use the normalized coordinates already collected by the employee monitoring agent.

==================================================
16. ADMIN ATTENDANCE MANAGEMENT
==================================================

Create an attendance management table.

Columns:

- Employee
- Scheduled Start
- First Activity
- Status
- Late By
- Total Active
- Total Idle

Statuses:

- On Time
- Late
- Absent
- Leave

Filters:

- Date
- Department
- Team
- Manager
- Status

==================================================
17. ADMIN ATTENDANCE RULES
==================================================

Create:

Settings → Attendance

Allow Admin to configure:

- Work start time
- Work end time
- Grace period
- Attendance calculation rules

Example:

Start:
09:00 AM

End:
05:00 PM

Grace period:
15 minutes

Rule:

Late after grace period.

Attendance can be based on first meaningful activity.

Design this so multiple shifts can be supported later.

==================================================
18. ADMIN STAR RULES
==================================================

Create:

Settings → Performance → Star Rules

Allow:

- Add rule
- Edit rule
- Disable rule
- Delete rule
- Change star value

Example rules:

On-time arrival → +2
Late arrival → -1
Task completed → +2
Task overdue → -2
Performance reward → +5

Show a rule preview before saving.

==================================================
19. ADMIN EMPLOYEE MANAGEMENT
==================================================

Create:

Organization → Employees

Actions:

- Add Employee
- Edit Employee
- Deactivate Employee
- Assign Manager
- Assign Team
- Assign Department
- Reset Device
- View Activity

Table:

- Name
- Email
- Department
- Team
- Manager
- Status
- Device
- Joined

Include:

- Search
- Filters
- Sorting
- Pagination

==================================================
20. ADMIN MANAGER MANAGEMENT
==================================================

Create:

Organization → Managers

Admin can:

- Create Manager
- Edit Manager
- Deactivate Manager
- Assign Team
- Assign Department
- Assign Employees

Manager detail page:

- Assigned Employees
- Teams
- Projects
- Tasks
- Attendance
- Performance

==================================================
21. ADMIN TEAM MANAGEMENT
==================================================

Create:

Organization → Teams

Team list should show:

- Team Name
- Manager
- Employees
- Active Employees
- Attendance
- Tasks
- Projects

Team detail tabs:

- Overview
- Members
- Attendance
- Tasks
- Projects
- Performance

==================================================
22. ADMIN PROJECT MANAGEMENT
==================================================

Admin can view and manage organization-wide projects.

Project table:

- Project
- Owner
- Manager
- Members
- Status
- Progress
- Tasks
- Due Date

Actions:

- Create Project
- Edit
- Archive
- Assign Manager
- Assign Employees
- View Tasks
- View Files

==================================================
23. ADMIN TASK MANAGEMENT
==================================================

Create organization-wide task management.

Columns:

- Task
- Project
- Employee
- Manager
- Priority
- Status
- Tracked Time
- Due Date

Statuses:

- To Do
- In Progress
- Paused
- Completed
- Overdue

Filters:

- Project
- Employee
- Manager
- Status
- Priority
- Date

==================================================
24. ADMIN PERFORMANCE
==================================================

Create:

Performance → Overview

Display:

- Attendance Rate
- Tasks Completed
- Task Completion Rate
- Active Time
- Idle Time
- Stars

Filters:

- Organization
- Department
- Team
- Employee

Do not create an employee ranking based solely on keystrokes or mouse activity.

==================================================
25. ADMIN REPORTS
==================================================

Create:

Reports

MVP reports:

- Attendance Report
- Employee Activity Report
- Screenshot Report
- Task Report
- Performance Report
- Stars Report

Filters:

- Date Range
- Employee
- Team
- Department
- Manager

Allow export where the existing backend supports it.

==================================================
26. ADMIN SETTINGS
==================================================

Create:

Settings

Sections:

- Organization
- Monitoring
- Attendance
- Performance
- Roles & Permissions
- Integrations
- Security

Monitoring settings:

- Screenshot interval
- Screenshot quality
- Idle threshold
- Keyboard metrics
- Mouse metrics
- Screenshot monitoring
- Data retention

If these settings already have backend support, connect the UI to the existing APIs.

If not, implement the required backend structure instead of creating fake toggles.

Configuration changes should eventually propagate to employee agents.

==================================================
27. ADMIN AUDIT LOG
==================================================

Create:

Audit Logs

Columns:

- Timestamp
- Actor
- Role
- Action
- Target
- IP/Device
- Details

Sensitive actions must be auditable.

Examples:

Admin changed screenshot interval.

Manager viewed an employee screenshot.

==================================================
28. MANAGER EXPERIENCE
==================================================

The Manager dashboard should feel like a:

"Team Operations Center"

It must NOT be a copy of the Employee dashboard.

The Manager should immediately understand:

- Number of assigned employees
- Who is online
- Who is idle
- Who is late
- Who is on break
- Active tasks
- Overdue tasks
- Project progress
- Team attendance
- Team activity

==================================================
29. MANAGER SIDEBAR
==================================================

Create:

Dashboard

My Team
- Employees
- Active
- Idle
- Attendance

Monitoring
- Screenshots
- Activity
- Heatmaps

Attendance
- Today
- History
- Reports

Projects
- My Projects
- Active
- Completed

Tasks
- Team Tasks
- In Progress
- Completed
- Overdue

Performance
- Team Overview
- Employee Performance

Documents
- Google Sheets
- Google Docs

DO NOT show:

- Organization Settings
- Roles & Permissions
- Security
- System-wide Configuration
- Manager Management

==================================================
30. MANAGER KPI CARDS
==================================================

Display:

- My Employees
- Online
- Late Today
- Idle
- On Break
- Tasks In Progress
- Tasks Completed
- Team Attendance

All values must come from real backend data.

==================================================
31. MANAGER TEAM OVERVIEW
==================================================

Create a real-time team table.

Columns:

- Employee
- Status
- Attendance
- Active Time
- Idle Time
- Current Task
- Task Progress
- Stars
- Last Activity

Manager must only see employees assigned to them.

==================================================
32. MANAGER EMPLOYEE DETAIL
==================================================

Manager can click an assigned employee.

Show:

- Employee Overview
- Attendance
- Activity
- Screenshots
- Heatmap
- Tasks
- Performance

Backend must verify that the employee belongs to the Manager's permitted scope.

==================================================
33. MANAGER SCREENSHOTS
==================================================

Create:

Monitoring → Screenshots

Manager can:

- Select assigned employee
- Select date
- Select time
- View screenshot timeline
- Open screenshot
- Filter activity

Manager must NEVER be able to access screenshots of employees outside their team.

This must be enforced by backend authorization.

==================================================
34. MANAGER ATTENDANCE
==================================================

Create:

Today's Attendance

Columns:

- Employee
- Scheduled Start
- First Activity
- Status
- Late By
- Active Time

Filters:

- On Time
- Late
- Absent
- On Break

Manager cannot modify organization-wide attendance rules.

==================================================
35. MANAGER TASK MANAGEMENT
==================================================

Manager can:

- Create Task
- Assign Task
- Edit Task
- Change Priority
- Change Due Date
- Change Status

Tasks may only be assigned within the Manager's permitted team/project scope.

Task table:

- Task
- Employee
- Project
- Priority
- Status
- Tracked Time
- Due Date

==================================================
36. MANAGER PROJECT MANAGEMENT
==================================================

Manager can:

- Create Project
- Manage assigned projects
- Add team members
- Create folders
- Create tasks
- Attach documents
- Attach Google Sheets
- Track progress

Manager cannot modify global organization settings.

==================================================
37. MANAGER PERFORMANCE
==================================================

Create:

Performance → Team Overview

Display:

- Attendance
- Active Time
- Idle Time
- Tasks Completed
- Completion Rate
- Stars

Allow Manager to inspect an individual assigned employee.

Do not create an opaque ranking based only on mouse/keyboard activity.

==================================================
38. MANAGER DOCUMENTS
==================================================

Manager can access documents attached to projects they manage.

Managers cannot access unrelated projects.

==================================================
39. PERMISSION MATRIX
==================================================

Implement these permissions at the backend level:

Feature | Admin | Manager | Employee

Own Dashboard | Yes | Yes | Yes
Organization Dashboard | Yes | No | No
View All Employees | Yes | No | No
View Assigned Employees | Yes | Yes | No
View Own Data | Yes | Yes | Yes
View Employee Screenshots | All | Assigned | Own if allowed
View Activity | All | Assigned | Own
View Attendance | All | Assigned | Own
Modify Attendance Rules | Yes | No | No
Modify Monitoring Rules | Yes | No | No
Manage Employees | Yes | Limited | No
Manage Managers | Yes | No | No
Manage Teams | Yes | Assigned Scope | No
Create Projects | Yes | Assigned Scope | No
Create Tasks | Yes | Yes | No
Manage Own Tasks | Yes | Yes | Yes
View Team Performance | Yes | Yes | No
View Organization Performance | Yes | No | No
Configure Stars | Yes | No | No
View Audit Logs | Yes | Limited | No
Organization Settings | Yes | No | No
Security Settings | Yes | No | No

The backend must enforce this matrix.

==================================================
40. UI/UX REQUIREMENTS
==================================================

Admin:

Visual hierarchy:

Organization Health
↓
Attendance
↓
Employee Status
↓
Tasks / Projects
↓
Performance
↓
Monitoring

Manager:

Team Health
↓
Employee Status
↓
Attendance
↓
Tasks
↓
Projects
↓
Performance
↓
Monitoring

Employee:

Keep the existing hierarchy:

My Work
My Tasks
My Attendance
My Timer
My Performance
My Projects

Admin and Manager interfaces should be visually consistent with the existing application design system, but clearly communicate their different purposes.

Do not make the three dashboards visually identical.

==================================================
41. STATES
==================================================

Every Admin and Manager page must have:

1. Loading state
2. Empty state
3. Error state
4. Success state where relevant

Examples:

"No employees assigned."

"No active projects."

"No tasks found."

"No screenshots available."

"No attendance records."

"No activity data."

Use skeleton loaders for:

- Dashboard cards
- Tables
- Charts
- Screenshot grids
- Employee details
- Project lists

API errors should show a clear message and Retry action.

Never silently replace failed API data with fake data.

==================================================
42. RESPONSIVE DESIGN
==================================================

Support desktop sizes:

1920×1080
1600×900
1440×900
1366×768
1280×720

Sidebar should collapse when required.

Tables must remain usable.

Do not allow cards, charts, or tables to overlap or break at smaller desktop sizes.

==================================================
43. DATA AND API RULE
==================================================

Every displayed metric must map to an actual backend data source.

Do NOT create:

- Fake buttons
- Fake charts
- Fake employee records
- Fake monitoring screens
- Decorative dashboards
- Hardcoded KPI values
- Duplicate Employee dashboard screens

If a required backend endpoint does not exist:

1. Identify the missing endpoint/data model.
2. Implement it using the existing architecture.
3. Add proper authorization.
4. Connect the frontend to it.
5. Test it.

Do not fake the result.

==================================================
44. SCREENSHOT SYSTEM
==================================================

The existing project requirement is that screenshots are captured by the employee agent and compressed before upload.

Do not redesign or replace this architecture unless the existing implementation requires it.

The dashboard should display the compressed screenshot assets efficiently.

Use thumbnails for screenshot grids.

Load the full screenshot only when the user opens it.

==================================================
45. IMPORTANT SECURITY REQUIREMENTS
==================================================

Role permissions are security boundaries.

Do not rely on:

- Hidden menu items
- Disabled buttons
- Frontend route guards only
- Client-side filtering

Backend authorization must exist for:

- Employee access
- Screenshot access
- Activity access
- Attendance access
- Task access
- Project access
- Manager access
- Organization settings
- Monitoring settings
- Security settings
- Audit logs

Test unauthorized API requests directly.

==================================================
46. TESTING REQUIREMENTS
==================================================

Before considering the implementation complete, test:

ADMIN:

- Login
- Admin dashboard
- Organization data
- Employee management
- Manager management
- Team management
- Attendance
- Screenshots
- Activity
- Projects
- Tasks
- Performance
- Reports
- Settings
- Audit logs

MANAGER:

- Login
- Manager dashboard
- Assigned employee visibility
- Employee details
- Screenshots
- Activity
- Attendance
- Tasks
- Projects
- Performance
- Documents

EMPLOYEE:

- Existing login
- Existing dashboard
- Existing tasks
- Existing attendance
- Existing timer
- Existing performance
- Existing projects

Also test:

Manager attempting to access Admin routes.

Manager attempting to access another Manager's employees.

Employee attempting to access Manager routes.

Employee attempting to access Admin routes.

Unauthorized API requests using manipulated IDs.

==================================================
47. DEVELOPMENT ORDER
==================================================

Implement in this order:

PHASE 1
Inspect existing architecture.

PHASE 2
Document current role/auth/data architecture internally.

PHASE 3
Implement backend role authorization.

PHASE 4
Implement Admin routing.

PHASE 5
Implement Admin layout/navigation.

PHASE 6
Implement Admin dashboard.

PHASE 7
Implement Admin organization management.

PHASE 8
Implement Admin monitoring/attendance/performance.

PHASE 9
Implement Manager routing.

PHASE 10
Implement Manager layout/navigation.

PHASE 11
Implement Manager dashboard.

PHASE 12
Implement Manager team management.

PHASE 13
Implement Manager monitoring/attendance/tasks/projects/performance.

PHASE 14
Connect all pages to real backend data.

PHASE 15
Implement loading/empty/error states.

PHASE 16
Test permissions.

PHASE 17
Regression-test the Employee dashboard.

==================================================
48. ANTIGRAVITY BEHAVIOR
==================================================

IMPORTANT:

Do not blindly modify the entire project.

Work incrementally.

Before modifying an existing file:

- Understand what it does.
- Determine whether it is shared.
- Preserve existing behavior.
- Make the smallest safe change.

Reuse existing components where appropriate.

Create new Admin/Manager components where role-specific behavior is required.

Keep the code maintainable.

Do not introduce unnecessary dependencies.

Do not rewrite the project architecture unless absolutely necessary.

Do not commit changes to GitHub automatically.

Before any Git commit, show me what changed and ask for my explicit permission.

Do not deploy the application.

Do not modify deployment configuration unless absolutely required for local development.

==================================================
49. FINAL SUCCESS CRITERIA
==================================================

The final application must clearly contain:

ADMIN
→ Organization Control Center

MANAGER
→ Team Operations Center

EMPLOYEE
→ Personal Work/Productivity Center

The three experiences must have:

- Separate routes
- Separate navigation
- Separate dashboards
- Separate permissions
- Separate data scopes
- Appropriate KPIs
- Appropriate actions
- Backend authorization

The existing Employee dashboard must remain functional.

Most importantly:

DO NOT simply duplicate the Employee dashboard and rename it.

The Admin dashboard must feel like an organization-level management system.

The Manager dashboard must feel like a team-level management system.

The Employee dashboard must remain focused on the individual employee.

==================================================
50. BEFORE YOU START CODING
==================================================

First inspect the repository and report:

1. Current frontend architecture
2. Current backend architecture
3. Current authentication system
4. Current role system
5. Existing Employee dashboard route
6. Existing reusable components
7. Existing API endpoints
8. Existing database/data models
9. What already exists for screenshots
10. What already exists for attendance
11. What already exists for tasks/projects
12. What must be added for Admin
13. What must be added for Manager
14. Any architectural conflicts or risks

Then propose the implementation changes.

DO NOT start destructive changes without my approval.

After the inspection, proceed with the implementation using the existing architecture.