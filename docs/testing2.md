# Task: Bundle the Employee Monitoring Agent into the Main Desktop Application Installer

## Objective

Modify the existing Employee Tracking Dashboard so that the employee needs to install only one application.

Currently, the desktop dashboard and `employee-agent.exe` have separate installation/startup requirements. I want to eliminate the separate agent installation process.

**Required outcome:** When the employee installs the desktop application, the installer also installs and configures the existing agent. After the employee completes the authorized setup and monitoring prerequisites are satisfied, the agent starts automatically and reports its actual status and collected data to the administrator dashboard.

Do not create a new agent or rewrite the existing collection system unless necessary. Reuse the existing executable, backend integration, screenshot compression, upload logic, and Supabase schema wherever possible.

## 1. Audit the Existing Architecture

Before making changes, inspect:

* Desktop application framework and entry point.
* Existing NSIS installer configuration.
* Location and build process of `employee-agent.exe`.
* Agent dependencies and runtime requirements.
* Current agent startup logic.
* Existing Supabase URL, authentication, employee ID, and device enrollment configuration.
* Screenshot compression and upload implementation.
* Heartbeat and online-presence reporting.
* Supabase Storage buckets, RLS policies, and database tables.
* Current administrator monitoring screens.

Identify exactly why installing the current NSIS package does not automatically result in live reporting.

Do not assume the problem is only the missing executable. Verify the complete data flow from installation to the administrator dashboard.

## 2. Produce One Self-Contained Installer

Modify the existing installer so it includes:

* Desktop dashboard application.
* Existing `employee-agent.exe`.
* All required agent dependencies and runtime files.
* Required configuration templates.
* Agent installation and lifecycle integration.
* Necessary shortcuts and uninstall integration.

Use the current packaging framework and NSIS configuration. Do not introduce a second installer or require a separate download.

The installer must verify that the agent executable and its required dependencies are present before declaring installation successful.

If the agent cannot be packaged because its source build or dependencies are missing, report the precise blocker rather than producing a misleading installer.

## 3. Install and Register the Agent Automatically

During installation:

1. Copy the agent and its dependencies into the appropriate protected application directory.
2. Verify the executable version and integrity.
3. Create the required application configuration.
4. Set up the approved background execution mechanism.
5. Register the agent for automatic startup when required by the configured monitoring policy.
6. Configure authorized device enrollment and employee association.
7. Verify that the installed agent can start and communicate with the backend.
8. Report installation errors clearly.
9. Provide a repair mechanism for missing or corrupted agent files.

Determine whether a Windows service or a user-session background process is appropriate for the existing agent.

Use the least privileges necessary. If service installation requires elevation, request it through the normal installer permission flow.

Do not use hidden persistence, conceal the process from employees, or bypass operating-system security controls.

## 4. Start Reporting Automatically

After installation, the agent must begin reporting automatically when the employee's authorized monitoring session becomes active.

The implementation must not require the employee to locate or launch `employee-agent.exe` manually.

At startup:

1. Confirm that the application and agent are installed correctly.
2. Authenticate the device and establish its employee association.
3. Retrieve the applicable monitoring policy.
4. Verify that monitoring is authorized and enabled.
5. Start the agent if it is not already running.
6. Wait for an actual agent health confirmation.
7. Send the initial heartbeat.
8. Begin the collection and upload operations already implemented by the agent.
9. Update the administrator dashboard when new data is successfully received.

Do not wait for the employee to open the dashboard repeatedly. Once the authorized background agent is running, it should continue its permitted reporting independently of the dashboard window.

If the agent cannot authenticate, cannot reach Supabase, or lacks the required configuration, show an appropriate status and recover when the issue is resolved.

## 5. Eliminate Manual Configuration Where Possible

The installer and enrollment flow should configure all non-secret settings automatically.

Use the project's existing configuration system for:

* Supabase project URL.
* Appropriate authentication mechanism.
* Device registration.
* Employee association.
* Agent version.
* Monitoring policy.
* Storage upload destination.

Do not hardcode a Supabase service-role key, administrator credentials, or other privileged secrets into the installer or executable.

If employee identity cannot be determined safely, provide an explicit enrollment or sign-in step. Do not assign an arbitrary employee ID or reuse another employee's identity.

Use an appropriate device-authentication mechanism, short-lived credentials, and backend authorization.

Do not require employees to manually edit environment variables or configuration files.

## 6. Fix the Full Reporting Pipeline

Verify and repair the entire pipeline:

Agent
→ Device authentication
→ Employee association
→ Heartbeat
→ Online presence
→ Authorized screenshot collection
→ Screenshot compression
→ Supabase Storage upload
→ Metadata/database record
→ Administrator dashboard refresh

Verify each stage independently.

Requirements:

* Heartbeats must update the actual device status.
* Screenshots must upload to the correct authorized storage location.
* Screenshot metadata must reference the correct employee and device.
* The administrator dashboard must retrieve the actual persisted data.
* Failed uploads must be retried safely.
* Temporary connectivity failures must not create duplicate records.
* The UI must distinguish an online agent from a successful recent upload.
* Storage and database policies must authorize the agent's operations without exposing privileged credentials.

Do not fabricate heartbeat records, screenshot entries, or successful uploads to make the dashboard appear live.

## 7. Keep Reporting Active When the Window Closes

The desktop dashboard and agent must have separate lifecycles.

* Closing the dashboard window must not stop the authorized background agent.
* Reopening the dashboard must reconnect to the existing agent.
* Multiple application launches must not create duplicate agents.
* Unexpected agent termination must trigger bounded recovery.
* Explicit authorized stop, pause, logout, and uninstall actions must follow the configured monitoring policy.
* Windows restart and employee login must restore the configured state when authorized.

Expose a normal, documented way to inspect agent status and stop or remove it as permitted by the organization's policy.

## 8. Make Administrator Live Reporting Accurate

Update the existing administrator monitoring views only where necessary.

Display:

* Employee and device association.
* Actual agent installation/version status.
* Online, offline, or reconnecting state.
* Last successful heartbeat.
* Last successful screenshot upload.
* Screenshot history from actual stored records.
* Agent startup or authentication errors.
* Stale-data warnings.

Refresh the interface through the existing realtime subscriptions or a suitable polling mechanism.

Do not treat installation alone as proof that live monitoring is working. The dashboard should show a truthful state until the first successful heartbeat and data upload have been verified.

## 9. Installer Upgrade and Uninstall

Support:

* Fresh installation.
* Upgrade from an existing dashboard-only installation.
* Upgrade from a version where the agent was installed separately.
* Repair of missing agent files.
* Agent version compatibility checks.
* Rollback or clear recovery instructions if an upgrade fails.
* Uninstallation of the application and its managed agent components.
* Appropriate cleanup of shortcuts, service registrations, and application files.

Do not delete employee monitoring records or shared Supabase data when uninstalling a local application.

## 10. Required Tests

Test the following scenarios on a clean Windows environment:

1. Install the application without manually installing the agent.
2. Verify that the installer places the agent and dependencies correctly.
3. Launch the application and verify automatic agent startup.
4. Confirm that the correct employee/device identity is associated.
5. Verify the first real heartbeat in Supabase.
6. Verify the first real screenshot upload, if enabled and authorized.
7. Confirm that the administrator dashboard displays the actual data.
8. Close the dashboard and confirm that the permitted background agent continues reporting.
9. Reopen the dashboard and confirm that no duplicate agent starts.
10. Disconnect and restore the network.
11. Test expired credentials and incorrect configuration.
12. Test an agent crash and recovery.
13. Upgrade an existing installation.
14. Uninstall and verify cleanup.
15. Verify that unauthorized devices cannot submit data for other employees.

Do not claim a test passed without running it and examining its result.

## 11. Implementation Constraints

* Preserve the existing application framework and working features.
* Reuse the existing agent rather than creating a replacement.
* Reuse Supabase where possible.
* Do not deploy the application as part of this task.
* Do not make GitHub commits without my permission.
* Do not overwrite unrelated files.
* Obtain approval before destructive migrations or significant permission changes.
* Explain any remaining manual prerequisites.

## 12. Final Deliverables

Provide:

1. A summary of the root cause.
2. A list of modified files.
3. The updated installer configuration.
4. The agent packaging and startup mechanism.
5. Any database or authentication changes.
6. Test results for the complete reporting pipeline.
7. The path to the newly built installer, if the build succeeds.
8. Any outstanding limitations.

The final acceptance criterion is:

**One installer installs the dashboard and agent. After authorized enrollment and startup, real agent health and collected data appear in the administrator dashboard without a separate agent installation or manual agent launch.**
