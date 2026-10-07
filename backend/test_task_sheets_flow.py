import json
import urllib.request

BASE_URL = "http://127.0.0.1:8000/api/v1"

def login(email, pwd):
    req = urllib.request.Request(
        f"{BASE_URL}/auth/login",
        data=json.dumps({"email": email, "password": pwd}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def api_get(endpoint, token):
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def api_post(endpoint, data, token):
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        data=json.dumps(data).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def api_put(endpoint, data, token):
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        data=json.dumps(data).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="PUT"
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def main():
    print("=== 1. ADMIN FLOW ===")
    admin = login("admin@tracking.local", "admin123")
    print(f"Logged in as Admin: {admin['name']} ({admin['role']})")
    
    # List all sheets for admin
    all_sheets = api_get("/sheets", admin["access_token"])
    print(f"Admin sees {len(all_sheets)} employee daily task sheets across company:")
    for s in all_sheets:
        print(f" - [{s['sheet_date']}] {s['employee_name']} ({s['employee_code']}) | Status: {s['status']} | Tasks: {s['completed_tasks']}/{s['total_tasks']} | Hours: {s['total_hours']}")

    stats = api_get("/sheets/stats/summary", admin["access_token"])
    print(f"Admin KPI Summary: {stats}")

    print("\n=== 2. MANAGER FLOW ===")
    mgr = login("manager@tracking.local", "manager123")
    print(f"Logged in as Manager: {mgr['name']} ({mgr['role']})")
    
    mgr_sheets = api_get("/sheets", mgr["access_token"])
    print(f"Manager sees {len(mgr_sheets)} team sheets:")
    for s in mgr_sheets:
        print(f" - [{s['sheet_date']}] {s['employee_name']} | Status: {s['status']} | Hours: {s['total_hours']}")

    # Manager reviews an employee sheet
    target_sheet = next(s for s in mgr_sheets if s["status"] == "SUBMITTED")
    print(f"Manager reviewing sheet for: {target_sheet['employee_name']}")
    review_resp = api_post(
        f"/sheets/{target_sheet['id']}/review",
        {"manager_feedback": "Excellent progress on task deliverables!", "status": "APPROVED"},
        mgr["access_token"]
    )
    print(f"Review result: Status: {review_resp['status']} | Feedback: {review_resp['manager_feedback']}")

    print("\n=== 3. EMPLOYEE FLOW ===")
    emp = login("alex@tracking.local", "alex123")
    print(f"Logged in as Employee: {emp['name']} ({emp['role']})")

    # Employee gets today sheet
    today_sh = api_get("/sheets/today", emp["access_token"])
    print(f"Alex today sheet: ID: {today_sh['id']} | Status: {today_sh['status']} | Tasks: {len(today_sh['tasks'])}")

    # Alex adds a new task
    new_task = api_post(
        f"/sheets/{today_sh['id']}/tasks",
        {
            "title": "Optimize Responsive Cards Grid Layout",
            "category": "Frontend Development",
            "priority": "HIGH",
            "status": "TODO",
            "hours_spent": 1.5,
            "description": "Fine-tuned CSS grid for multiple employee daily task cards."
        },
        emp["access_token"]
    )
    print(f"Alex added task: ID: {new_task['id']} | Title: {new_task['title']} | Hours: {new_task['hours_spent']}")

    # Alex marks task completed
    updated_task = api_put(
        f"/sheets/tasks/{new_task['id']}",
        {"status": "COMPLETED"},
        emp["access_token"]
    )
    print(f"Alex updated task status to: {updated_task['status']}")

    # Alex submits daily sheet
    submitted_sh = api_put(
        f"/sheets/{today_sh['id']}",
        {
            "summary_notes": "Completed daily feature implementation and tested all card grid states.",
            "status": "SUBMITTED"
        },
        emp["access_token"]
    )
    print(f"Alex submitted sheet: Status: {submitted_sh['status']} | Total Hours: {submitted_sh['total_hours']}")

    print("\nALL WORKFLOWS TESTED AND PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
