# Real Live Screen + Record Screen

## Apply DB migration

Run in Supabase SQL Editor:

`supabase/migrations/014_live_record_commands.sql`

Creates:

- `agent_commands` — admin/manager → agent control channel
- `employee_live_sessions` — latest live JPEG pointer
- `screen_recordings.frame_manifest` — real frame-sequence recordings

## How it works

1. **Live Screen** inserts `start_live`; agent uploads `live/{employee_id}/latest.jpg` ~1/sec and upserts `employee_live_sessions`. UI polls the session URL. Close sends `stop_live`.
2. **Record Screen** inserts `record`; agent captures real desktop frames for 10s @ 2fps, uploads to `recordings/{id}/frame_*.jpg`, inserts `screen_recordings` with `frame_manifest`. UI plays via `FrameSequencePlayer`.

`employee_id` on commands must match the agent `EMPLOYEE_ID` (auth/profile user id from `agent.env`, usually `employees.user_id`).

## Ship agent

```bash
cargo build --release --manifest-path employee-agent/Cargo.toml
npm run prepare:agent
npm run build:desktop
```

Redeploy the desktop app / agent on employee machines after applying the migration.
