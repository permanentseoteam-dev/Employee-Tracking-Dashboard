import os
import json
import urllib.request
import sqlite3

db_path = "tracking.db" if os.path.exists("tracking.db") else "backend/tracking.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
tables = [r[0] for r in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("Tables:", tables)

for t in tables:
    cnt = cursor.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
    print(f"Table {t}: {cnt} rows")

print("\nTesting backend login:")
try:
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/auth/login",
        data=json.dumps({"email": "admin@tracking.local", "password": "admin123"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        print("Login status:", resp.status)
        resp_data = json.loads(resp.read().decode())
        token = resp_data["access_token"]
        print("Logged in as:", resp_data["name"])

    # Test /api/v1/employees
    req_emp = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/employees",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req_emp) as resp:
        print("Employees endpoint status:", resp.status)
        emps = json.loads(resp.read().decode())
        print(f"Fetched {len(emps)} employees successfully!")
        for e in emps[:3]:
            print(" -", e["employee_code"], e["name"], e["email"], e["role"])

    # Test Rules API (Create, Toggle, Delete)
    print("\nTesting Rules API Lifecycle:")
    # 1. Create rule with Title and Description
    create_payload = json.dumps({
        "name": "Remote Friday Flex Hours",
        "description": "Allows employees 30 minutes extended grace period on Fridays.",
        "rule_type": "CUSTOM",
        "is_active": True,
        "config_payload": {"friday_grace_minutes": 30, "scope": "REMOTE"}
    }).encode()
    req_rule = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/rules",
        data=create_payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req_rule) as resp:
        rule_data = json.loads(resp.read().decode())
        rule_id = rule_data["id"]
        print(f"[CREATE] Status: {resp.status} | Title: {rule_data['name']} | Desc: {rule_data['description']} | Active: {rule_data['is_active']}")

    # 2. Toggle active -> False
    toggle_payload = json.dumps({"is_active": False}).encode()
    req_toggle = urllib.request.Request(
        f"http://127.0.0.1:8000/api/v1/rules/{rule_id}",
        data=toggle_payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="PUT"
    )
    with urllib.request.urlopen(req_toggle) as resp:
        updated_rule = json.loads(resp.read().decode())
        print(f"[TOGGLE] Status: {resp.status} | Active changed to: {updated_rule['is_active']}")

    # 3. Delete rule
    req_del = urllib.request.Request(
        f"http://127.0.0.1:8000/api/v1/rules/{rule_id}",
        headers={"Authorization": f"Bearer {token}"},
        method="DELETE"
    )
    with urllib.request.urlopen(req_del) as resp:
        del_res = json.loads(resp.read().decode())
        print(f"[DELETE] Status: {resp.status} | Result: {del_res['message']}")
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code, e.read().decode())
except Exception as e:
    print("Error:", e)

