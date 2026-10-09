import sqlite3
import os

db_path = os.path.expandvars(r'%LOCALAPPDATA%\EmployeeTracking\agent_outbox.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("SELECT count(*) FROM outbox_events;")
print('outbox_events count:', c.fetchone()[0])
c.execute("SELECT count(*) FROM outbox_screenshots;")
print('outbox_screenshots count:', c.fetchone()[0])

c.execute("SELECT * FROM outbox_events LIMIT 3;")
print('Rows:', c.fetchall())
