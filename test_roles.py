import urllib.request, json

def test_login(email, pwd):
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/auth/login",
        data=json.dumps({"email": email, "password": pwd}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

try:
    admin_auth = test_login("admin@tracking.local", "admin123")
    print("Admin login:", admin_auth["name"], admin_auth["role"])
    
    manager_auth = test_login("manager@tracking.local", "manager123")
    print("Manager login:", manager_auth["name"], manager_auth["role"])
    
    emp_auth = test_login("alex@tracking.local", "alex123")
    print("Employee login:", emp_auth["name"], emp_auth["role"])
except Exception as e:
    print("Login error:", e)
