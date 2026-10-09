import sqlite3
import os

db_path = os.path.expandvars(r'%LOCALAPPDATA%\EmployeeTracking\agent_outbox.db')

conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("SELECT event_type, payload_json FROM outbox_events LIMIT 5;")
for ev_type, p_json in c.fetchall():
    print(f"[{ev_type}]: {p_json}\n")

c.execute("SELECT id, captured_at, metadata_json FROM outbox_screenshots LIMIT 3;")
for s_id, cat, meta in c.fetchall():
    print(f"[Screenshot {s_id} at {cat}]: {meta}\n")
