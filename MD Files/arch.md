# Employee Monitoring Desktop App 

# Architecture Specification 

## 1. Architecture Goals 

The application is a Windows desktop employee monitoring and workforce-management system. 

The architecture must prioritize: 

- Reliability 

- Low resource usage 

- Secure communication 

- Offline support 

- Accurate synchronization 

- Modular native functionality 

- Maintainability 

- Future extensibility 

- Clear separation between UI and native functionality 

The MVP must support: 

- Employee authentication 

- Device registration 

- Background agent 

- Activity monitoring 

- Active/idle detection 

- Attendance events 

- Configurable screenshots 

- Screenshot compression 

- Screenshot upload 

- Offline queue 

- Remote configuration 

- Task management 

- Task timer 

- General breaks 

- Namaz breaks 

- Agent health 

- Backend synchronization 

The MVP must NOT implement: 

- Live screen viewing 

- Live screen recording 

- Long-term video storage 

Live monitoring must remain a future extension of the architecture. 

# 2. Technology Stack 

## Desktop Framework 

Tauri 

## Native Backend 

Rust 

## Frontend 

React TypeScript ## Local Database SQLite ## API Communication HTTPS REST API ## Real-Time Communication 

WebSocket where required ## Screenshot Storage 

Temporary local filesystem + remote object storage 

## Target Platform 

Windows 10+ Windows 11 

The architecture should support future macOS and Linux implementations through platform abstractions. 

# # 3. High-Level Architecture 

|```text||
|---|---|
|<br>|┌─────────────────────────────┐<br>│       Manager/Admin         │|
||│          Dashboard          │|
||└──────────────┬──────────────┘|
||│|
||│ HTTPS / WebSocket|
||│|
||┌──────────────▼──────────────┐|
||│         Backend API         │|
||│                              │|
|ii|│ Authentication              │|
||│ Employees                    │|
||│ Devices                      │|
|i|│ Activity                     │|
|t|│ Attendance                   │|
||│ Screenshots                  │|
||│ Tasks                        │|
||│ Projects                     │|
|ii|│ Configuration                │|
||│ Agent Health                 │|
||└──────────────┬───────────────┘|
||│|
||┌──────────────┴───────────────┐|
||│                              │|





<!-- Start of picture text -->
▼ ▼<br>                  ┌──────────────┐              ┌──────────────┐<br>                  │   Database   │              │   Object     │<br>                  │              │              │   Storage    │<br>                  │ Employees    │              │              │<br>                  │ Devices      │              │ Screenshots  │<br>                  │ Activity     │              │ Thumbnails   │<br>                  │ Attendance   │              │              │<br>                  │ Tasks        │              │              │<br>                  └──────────────┘              └──────────────┘<br><!-- End of picture text -->

# EMPLOYEE WINDOWS MACHINE 



<!-- Start of picture text -->
┌─────────────────────────────────────────────────────────────┐<br>│                    Tauri Desktop App                        │<br>│                                                             │<br>│  ┌───────────────────────────────────────────────────────┐  │<br>│  │              React + TypeScript UI                    │  │<br>│  │                                                       │  │<br>│  │ Dashboard │ Attendance │ Tasks │ Timer │ Settings    │  │<br>│  └────────────────────────── ┬ ────────────────────────────┘  │<br>│                             │                               │<br>│                        Tauri Bridge                         │<br>│                             │                               │<br>│  ┌────────────────────────── ▼ ────────────────────────────┐  │<br>│  │                    Rust Core                          │  │<br>│  │                                                       │  │<br>│  │ Authentication                                        │  │<br><!-- End of picture text -->

|│  │ Device Manager|│  │|
|---|---|
|│  │ Activity Monitor|i                                       │  │|
|│  │ Attendance|t                                            │  │|
|│  │ Screenshot|│  │|
|│  │ Compression|│  │|
|│  │ Local Queue|│  │|
|│  │ Synchronization|i                                       │  │|
|│  │ Configuration|ii                                         │  │|
|│  │ Timer|│  │|
|│  │ Health|│  │|
|│  └─────────────────|─────────┬────────────────────────────┘  │|
|│                             │|│|
|│                       ┌─────▼|─────┐                         │|
|│                       │  SQLite|│                         │|
|│                       │           │|│|
|│                       │ Config|i    │                         │|
|│                       │ Timer|│                         │|
|│                       │ Outbox|│                         │|
|│                       │ Queue|│                         │|
|│                       └───────<br>└───────────────────|────┘                         │<br>──────────────────────────────────────────┘|



