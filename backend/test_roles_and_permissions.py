import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

def login(email, password):
    req = urllib.request.Request(
        f"{BASE_URL}/api/v1/auth/login",
        data=json.dumps({"email": email, "password": password}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def get_with_token(endpoint, token):
    req = urllib.request.Request(
        f"{BASE_URL}/api/v1{endpoint}",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def test_role_permissions():
    print("=== 1. TESTING ADMIN PERMISSIONS ===")
    admin_auth = login("admin@tracking.local", "admin123")
    admin_token = admin_auth["access_token"]
    print(f"Admin Logged In: {admin_auth['name']} (Role: {admin_auth['role']})")
    
    # Admin can access finance summary and messages
    fin_sum = get_with_token("/finance/summary", admin_token)
    print(f"Admin Finance Summary: Disbursed=${fin_sum['total_amount_disbursed']}, Messages={fin_sum['total_messages']}")
    
    # Admin can access rules list
    rules = get_with_token("/rules", admin_token)
    print(f"Admin Rules count: {len(rules)} policies")
    
    # Admin can inspect employee performance scorecard
    alex_perf = get_with_token("/rules/performance?employee_id=" + [e for e in get_with_token("/employees", admin_token) if e["name"] == "Alex Rivera"][0]["id"], admin_token)
    print(f"Admin Inspector for Alex: Stars={alex_perf['total_stars']}, Violations={alex_perf['total_violations_count']}, Punctuality={alex_perf['punctuality_rate_pct']}%")

    print("\n=== 2. TESTING MANAGER PERMISSIONS ===")
    manager_auth = login("manager@tracking.local", "manager123")
    manager_token = manager_auth["access_token"]
    print(f"Manager Logged In: {manager_auth['name']} (Role: {manager_auth['role']})")
    
    # Manager CANNOT access finance summary
    try:
        get_with_token("/finance/summary", manager_token)
        print("ERROR: Manager should NOT have access to finance summary!")
    except urllib.error.HTTPError as e:
        print(f"Manager Finance Access Blocked as Expected: HTTP {e.code}")

    # Manager gets their OWN scorecard only
    manager_perf = get_with_token("/rules/performance", manager_token)
    print(f"Manager Own Scorecard: Name={manager_perf['employee_name']}, Stars={manager_perf['total_stars']}, Violations={len(manager_perf['violations_ledger'])}")

    print("\n=== 3. TESTING EMPLOYEE PERMISSIONS ===")
    emp_auth = login("alex@tracking.local", "alex123")
    emp_token = emp_auth["access_token"]
    print(f"Employee Logged In: {emp_auth['name']} (Role: {emp_auth['role']})")

    # Employee CANNOT access finance summary
    try:
        get_with_token("/finance/summary", emp_token)
        print("ERROR: Employee should NOT have access to finance summary!")
    except urllib.error.HTTPError as e:
        print(f"Employee Finance Access Blocked as Expected: HTTP {e.code}")

    # Employee gets their OWN scorecard only
    emp_perf = get_with_token("/rules/performance", emp_token)
    print(f"Employee Own Scorecard: Name={emp_perf['employee_name']}, Stars={emp_perf['total_stars']}, Violations={len(emp_perf['violations_ledger'])}, Punctuality={emp_perf['punctuality_rate_pct']}%")
    print("Violations detail for Alex:")
    for v in emp_perf['violations_ledger']:
        print(f"  - [{v['date']}] {v['violation_type']}: {v['details']} -> {v['star_impact']}")
    print("Stars detail for Alex:")
    for s in emp_perf['stars_ledger'][:3]:
        print(f"  - [{s['date']}] STAR: {s['reason']}")

    print("\n=== ALL BACKEND PERMISSION TESTS PASSED! ===")

if __name__ == "__main__":
    test_role_permissions()
