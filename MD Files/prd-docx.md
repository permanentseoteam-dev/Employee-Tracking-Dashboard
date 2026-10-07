**Employee Tracking Dashboard — PRD**

**1\. Product Goal**

Build a lightweight employee attendance and activity tracking platform consisting of:

- Windows desktop agent
- Admin dashboard
- Manager dashboard
- Employee dashboard
- FastAPI backend
- PostgreSQL database
- Object storage for compressed screenshots

V1 must NOT include:

- Live screen viewing
- Live screen streaming
- Screen recording
- Raw keyboard logging
- Clipboard monitoring
- Microphone/camera monitoring

The system must minimize CPU, RAM, disk and network usage on employee computers.

Monitoring must operate according to the organization's disclosed monitoring policy.

**2\. User Roles**

**Admin**

Admin has full access.

Admin can:

- Create employees
- Edit employees
- Disable employees
- Create managers
- Create departments
- Assign employees to managers
- Register devices
- Configure working hours
- Configure attendance rules
- Configure star rules
- Configure screenshot interval
- Configure monitoring schedule
- Configure screenshot retention
- View all attendance
- View all screenshots
- View activity
- View performance
- View audit logs

**Manager**

Manager can:

- View assigned employees
- View attendance
- View lateness
- View screenshots for assigned employees
- View activity statistics
- View performance
- View stars
- Filter employees
- View employee history

Manager cannot access employees outside their assigned scope.

**Employee**

Employee can:

- View own attendance
- View own activity statistics
- View own stars
- View own performance
- View own history

Employee cannot:

- View other employees
- Modify attendance
- Modify activity
- Modify screenshots
- Modify stars
- Modify monitoring rules

**3\. Authentication**

Implement:

- Login
- Logout
- Password hashing
- Role-based authorization
- Password reset

Roles:

ADMIN

MANAGER

EMPLOYEE

**4\. Employee Management**

Admin can create:

Employee

Manager

Department

Device

Employee fields:

id

employee_code

name

email

department_id

manager_id

role

status

created_at

updated_at

Employee status:

ACTIVE

INACTIVE

SUSPENDED

**5\. Windows Desktop Agent**

Build the desktop agent using Rust.

The agent handles:

Attendance

Session detection

First activity detection

Idle detection

Keyboard activity count

Mouse activity aggregation

Screenshot scheduling

Screenshot compression

Local queue

Background upload

Device heartbeat

The agent must NOT record actual keyboard characters.

Only store:

key_press_count

mouse_click_count

mouse_move_count

active_seconds

idle_seconds

Never store:

typed_text

passwords

keyboard characters

clipboard contents

**6\. Attendance**

Track:

PC boot

Windows login

Agent online

First meaningful activity

Last activity

Session end

PC boot alone must not automatically mark attendance.

Attendance should be determined using the employee's configured work schedule and first meaningful activity.

Example:

Shift: 09:00

First activity: 08:54

Status: PRESENT

Shift: 09:00

First activity: 09:18

Status: LATE

Attendance states:

PRESENT

LATE

ABSENT

EARLY

OFFLINE

Attendance record:

id

employee_id

date

boot_time

login_time

first_activity

last_activity

active_seconds

idle_seconds

status

**7\. Attendance Rules**

I'll set them later. Just leave a gap for the rules to be entered

**8\. Screenshot System**

Screenshot capture must be configurable.

Supported intervals:

1 minute

5 minutes

10 minutes

15 minutes

30 minutes

Custom

Also configure:

Monitoring start time

Monitoring end time

Working days

Example:

Monday-Friday

09:00-18:00

Screenshot interval: 10 minutes

Screenshot processing must happen on the employee machine before upload.

Pipeline:

Capture

&nbsp; ↓

Resize

&nbsp; ↓

Compress

&nbsp; ↓

WebP/JPEG

&nbsp; ↓

Local queue

&nbsp; ↓

Background upload

&nbsp; ↓

Object storage

Do not upload raw screenshots.

Do not store screenshot binaries in PostgreSQL.

PostgreSQL stores screenshot metadata.

**9\. Screenshot Compression**

Default processing:

Input:

1920x1080 screenshot

Processing:

Resize if necessary

Convert to WebP

Compress

Output:

Optimized screenshot

Use configurable:

maximum width

maximum height

compression quality

Target smaller files while preserving enough visual information for dashboard review.

Compression must not block attendance/activity processing.

**10\. Screenshot Local Queue**

Screenshots must first enter a local queue.

Screenshot

&nbsp; ↓

Compressed image

&nbsp; ↓

SQLite queue

&nbsp; ↓

Uploader worker

&nbsp; ↓

FastAPI

&nbsp; ↓

Object storage

If network is unavailable:

Screenshot

&nbsp; ↓

SQLite

&nbsp; ↓

Wait

&nbsp; ↓

Network available

&nbsp; ↓

Upload

Implement retry with exponential backoff.

Limit local queue size.

Old failed items must not grow indefinitely.

**11\. Activity Tracking**

Track aggregate activity.

Metrics:

key_press_count

mouse_click_count

mouse_move_count

active_seconds

idle_seconds

Do not send individual events continuously.

Aggregate locally.

Example:

10:00-10:05

Keys: 428

Clicks: 71

Mouse movements: 1,942

Active: 4m 31s

Idle: 29s

Upload activity in batches.

**12\. Mouse Heatmap**

Do not upload every mouse coordinate.

Convert mouse activity into a grid locally.

Example:

20 x 12 grid

Store:

screen_width

screen_height

grid_x

grid_y

interaction_count

Example:

cell_1_1: 14

cell_1_2: 8

cell_1_3: 2

Upload aggregated data periodically.

**13\. Performance Dashboard**

Performance metrics:

Attendance

Punctuality

Active time

Idle time

Activity metrics

Stars

Do not represent keyboard count or mouse movement as a definitive productivity score.

Use the term:

Activity Metrics

instead of:

Productivity Truth

**14\. Admin Dashboard**

Pages:

/dashboard

/employees

/employees/:id

/attendance

/screenshots

/activity

/performance

/rules

/devices

/departments

/settings

/audit-logs

Dashboard metrics:

Total Employees

Present

Late

Absent

Offline

Average Attendance

Total Stars

**15\. Manager Dashboard**

Pages:

/dashboard

/team

/team/:employeeId

/attendance

/screenshots

/activity

/performance

All manager queries must be restricted to assigned employees.

**16\. Employee Dashboard**

Pages:

/dashboard

/attendance

/activity

/performance

/stars

/history

Employee only sees personal records.

**17\. Screenshot Gallery**

Display:

Employee

Date

Time

Device

Screenshot

Features:

Date filter

Time filter

Employee filter

Device filter

Pagination

Thumbnail preview

Full-size preview

Never load every screenshot at once.

Use pagination or infinite loading.

**19\. Data Retention**

Admin-configurable retention:

Screenshots: configurable

Activity: configurable

Attendance: long-term

Audit logs: long-term

Expired screenshots must be automatically removed from object storage.

**20\. V1 Exclusions**

Do not implement:

Live screen viewing

Live screen streaming

Screen recording

Raw keylogging

Clipboard monitoring

Password capture

Microphone monitoring

Camera monitoring

Browser history tracking

Private message capture

Stealth monitoring mechanisms

The architecture should allow live monitoring to be added as a future module without implementing it in V1.

**21\. Success Criteria**

V1 is complete when:

- Admin can manage employees.
- Managers can manage/view assigned employees.
- Employees can view their own performance.
- Windows agent registers a device.
- Attendance is automatically calculated.
- Late arrivals are detected.
- Configurable star rules work.
- Screenshots are captured according to schedule.
- Screenshots are compressed before upload.
- Screenshots are queued locally before upload.
- Screenshots can be viewed from the dashboard.
- Keyboard activity is counted without storing keystrokes.
- Mouse activity is aggregated.
- Mouse heatmaps work.
- Activity statistics work.
- Role-based permissions work.
- Audit logging works.
- Agent resource usage remains low.
- No live screen feature exists in V1.