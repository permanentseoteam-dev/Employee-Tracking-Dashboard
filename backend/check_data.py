import json
import urllib.request
import sqlite3

conn = sqlite3.connect("backend/tracking.db")
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
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code, e.read().decode())
except Exception as e:
    print("Error:", e)

