# Employee Monitoring Desktop App — PRD 

## 1. Product 

A Windows desktop employee-management agent that collects configured activity metrics, screenshots, attendance events, and task-time data and synchronizes them with a manager/admin dashboard. 

# ## 2. MVP Goal 

Build a reliable employee desktop agent that: 

- Authenticates employees and devices 

- Runs as a background agent 

- Tracks online/offline state 

- Tracks aggregate keyboard and mouse activity 

- Detects active/idle state 

- Generates attendance events 

- Captures configurable screenshots 

- Compresses screenshots before upload 

- Queues data while offline 

- Synchronizes data reliably 

- Supports employee tasks and timers 

- Supports general and Namaz breaks 

- Displays employee-facing status and information 

# ## 3. Target 

- Windows 10+ 

- Windows 11 

- Desktop application 

- Tauri + Rust + React + TypeScript 

## 4. Employee Features 

# ### Authentication 

- Login 

- Logout 

- Session expiration 

- Token refresh 

- Device registration 

# ### Dashboard 

- Agent status 

- Attendance 

- Active time 

- Today's tasks 

- Task status 

- Synchronization status 

# ### Attendance 

- Detect first meaningful activity 

- Send attendance event 

- Backend calculates final attendance status 

- Support schedule and grace period 

# ### Activity 

Track only aggregate metrics: 

- Keyboard event count 

- Mouse movement count 

- Mouse click count 

- Active seconds 

- Idle seconds 

- Last activity 

Never store actual typed characters. 

### Screenshots 

- Configurable interval 

- Capture configured display 

- Resize when required 

- Compress 

- Generate thumbnail 

- Upload securely 

- Remove temporary local copy after successful upload 

### Offline Mode 

- Store activity locally 

- Store screenshots locally 

- Encrypt queued data 

- Retry automatically 

- Prevent duplicates 

- Sync after reconnection 

### Tasks 

Employees can: 

- View projects 

- View assigned tasks 

- Start task 

- Pause task 

- Resume task 

- Take break 

- Take Namaz break 

- Finish task 

### Timer 

- Timestamp-based timer 

- Survives application restart 

- Calculates productive time accurately 

- Excludes break time 

## 5. Admin/Manager Requirements 

The backend/dashboard must support: 

- Employee management 

- Device management 

- Monitoring configuration 

- Screenshot viewing 

- Activity data 

- Attendance data 

- Task/project assignment 

- Agent health 

- Synchronization status 

## 6. Remote Configuration 

Backend controls: 

- Screenshot interval 

- Screenshot quality 

- Screenshot dimensions 

- Idle threshold 

- Keyboard tracking 

- Mouse tracking 

- Screenshot tracking 

Configurations must be versioned. 

## 7. Security 

Required: 

- HTTPS 

- Secure authentication 

- Secure token storage 

- Encrypted local queue 

- Authenticated API requests 

- Backend RBAC 

- Input validation 

- Audit logging 

Never store: 

- Passwords 

- Authentication tokens in logs 

- Actual keyboard characters 

- Sensitive secrets 

## 8. Explicitly Out of MVP 

- Live screen viewing 

- Live screen recording 

- Long-term video storage 

- AI productivity scoring 

- AI employee analysis 

- Keylogging 

- Password capture 

- Website history monitoring 

- Mobile application 

- Payroll 

- HR integrations 

- Advanced reporting 

Live monitoring will be a future version. 

## 9. Acceptance Criteria 

The MVP must support this complete flow: 

Employee Login 

- → Device Registration 

- → Agent Online 

- → Activity Detection 

- → Attendance Event 

- → Screenshot Capture 

- → Compression 

- → Upload 

- → Dashboard Display 

Offline: 

Internet Lost 

- → Local Queue 

- → Internet Restored 

- → Synchronization 

- → No Duplicate Data 

Tasks: 

Start 

- → Timer 

- → Break/Namaz 

- → Resume 

- → Finish 

- → Correct Productive Time 

## 10. Definition of Done 

- Windows application installs 

- Login works 

- Device registration works 

- Background agent works 

- Online/offline status works 

- Activity tracking works 

- Active/idle detection works 

- Attendance works 

- Screenshot capture works 

- Screenshot compression works 

- Screenshot upload works 

- Offline queue works 

- Synchronization works 

- Tasks work 

- Timer works 

- Breaks work 

- Namaz break works 

- Timer survives restart 

- Agent health works 

- Tests pass 

- No live monitoring exists in MVP 

