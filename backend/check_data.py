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

    # 4. Test Finance API
    print("\nTesting Finance API:")
    # Summary
    req_fin_sum = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/finance/summary",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req_fin_sum) as resp:
        sum_data = json.loads(resp.read().decode())
        print(f"[FINANCE SUMMARY] Messages: {sum_data['total_messages']} | Disbursed: ${sum_data['total_amount_disbursed']} | Staff: {sum_data['total_employees']}")

    # List messages
    req_fin_msgs = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/finance/messages",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req_fin_msgs) as resp:
        msgs = json.loads(resp.read().decode())
        print(f"[FINANCE MESSAGES] Listed {len(msgs)} messages:")
        for m in msgs:
            print(f"  - [{m['message_type']}] To: {m['recipient_name']} | Subject: {m['subject']} | Amount: ${m['amount']}")

    # Send a new finance message as Admin to Alex Rivera
    alex_id = [e["id"] for e in emps if "Alex" in e["name"]][0]
    send_payload = json.dumps({
        "recipient_id": alex_id,
        "subject": "Monthly Remote Home-Office Stipend",
        "message": "Approved $150 internet and ergonomic equipment stipend for this billing cycle.",
        "amount": 150.0,
        "message_type": "REIMBURSEMENT",
        "priority": "NORMAL",
        "notify_others": True
    }).encode()
    req_send_fin = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/finance/messages",
        data=send_payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req_send_fin) as resp:
        sent_msg = json.loads(resp.read().decode())
        print(f"[FINANCE SEND] Status: {resp.status} | To: {sent_msg['recipient_name']} | Subject: {sent_msg['subject']}")

    # Check notifications for Alex
    # Log in as Alex
    req_alex_login = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/auth/login",
        data=json.dumps({"email": "alex@tracking.local", "password": "alex123"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_alex_login) as resp:
        alex_token = json.loads(resp.read().decode())["access_token"]

    req_alex_notifs = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/finance/notifications",
        headers={"Authorization": f"Bearer {alex_token}"}
    )
    with urllib.request.urlopen(req_alex_notifs) as resp:
        alex_notifs = json.loads(resp.read().decode())
        print(f"[EMPLOYEE NOTIFICATIONS] Alex received {len(alex_notifs)} notifications:")
        for n in alex_notifs[:3]:
            safe_title = n['title'].encode('ascii', errors='replace').decode()
            print(f"  - [{n['notification_type']}] {safe_title} (Read: {n['is_read']})")

    # Test that Employee cannot send finance messages (Admin Only Gate)
    try:
        req_unauth_send = urllib.request.Request(
            "http://127.0.0.1:8000/api/v1/finance/messages",
            data=send_payload,
            headers={"Authorization": f"Bearer {alex_token}", "Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req_unauth_send) as resp:
            print("Unexpected success by employee!")
    except urllib.error.HTTPError as e:
        print(f"[SECURITY ROLE GATE] Employee send blocked with HTTP {e.code} Forbidden: {e.read().decode()}")

    # Test Screenshot Listing and Deletion APIs
    req_ss_list = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/screenshots?page=1&limit=5",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req_ss_list) as resp:
        ss_data = json.loads(resp.read().decode())
        print(f"\n[SCREENSHOTS API] Total screenshots available: {ss_data['total']}, items on page: {len(ss_data['items'])}")
        if ss_data['items']:
            target_ss = ss_data['items'][0]
            target_id = target_ss['id']
            print(f"[SCREENSHOT TEST] Target screenshot to delete: {target_id} ({target_ss['employee_name']})")
            
            # Delete single screenshot
            req_del_single = urllib.request.Request(
                f"http://127.0.0.1:8000/api/v1/screenshots/{target_id}",
                headers={"Authorization": f"Bearer {token}"},
                method="DELETE"
            )
            with urllib.request.urlopen(req_del_single) as del_resp:
                del_result = json.loads(del_resp.read().decode())
                print(f"[DELETE SINGLE SCREENSHOT] Status: {del_resp.status} | Response: {del_result}")
            
            # Verify deleted
            try:
                urllib.request.urlopen(req_del_single)
            except urllib.error.HTTPError as err:
                print(f"[DELETE VERIFICATION] Re-deletion returns HTTP {err.code} Not Found as expected!")

except urllib.error.HTTPError as e:
    print("HTTPError:", e.code, e.read().decode())
except Exception as e:
    print("Error:", e)


