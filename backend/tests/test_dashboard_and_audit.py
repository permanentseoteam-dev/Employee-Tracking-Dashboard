from datetime import date, datetime, timedelta, timezone
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_metrics_aggregation(client: AsyncClient, seed_data: dict):
    # Login as Admin
    admin_login = await client.post(
        "/api/v1/auth/login", json={"email": "admin@test.com", "password": "admin123"}
    )
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Register Bob's device and simulate present attendance
    reg_bob = await client.post(
        "/api/v1/devices/register",
        json={"employee_code": "EMP001", "device_identifier": "HW-DASH-BOB", "hostname": "BOB-PC"},
    )
    bob_token = reg_bob.json()["api_token"]

    today_str = date.today().isoformat()
    await client.post(
        "/api/v1/agent/sync/batch",
        headers={"X-Device-Token": bob_token},
        json={
            "activity_batches": [
                {
                    "start_time": f"{today_str}T08:55:00Z",
                    "end_time": f"{today_str}T09:00:00Z",
                    "key_press_count": 50,
                    "mouse_click_count": 10,
                    "mouse_move_count": 100,
                    "active_seconds": 300,
                    "idle_seconds": 0,
                }
            ]
        },
    )

    # Query Dashboard Metrics as Admin
    dash_res = await client.get("/api/v1/dashboard/metrics", headers=admin_headers)
    assert dash_res.status_code == 200
    metrics = dash_res.json()
    assert metrics["total_employees"] >= 4
    assert metrics["present_today"] >= 1


@pytest.mark.asyncio
async def test_departments_crud_and_audit_logging(client: AsyncClient, seed_data: dict):
    admin_login = await client.post(
        "/api/v1/auth/login", json={"email": "admin@test.com", "password": "admin123"}
    )
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create new department
    create_dept = await client.post(
        "/api/v1/departments",
        headers=admin_headers,
        json={"name": "Product Design", "code": "DSN"},
    )
    assert create_dept.status_code == 201
    dept_id = create_dept.json()["id"]

    # List departments
    list_dept = await client.get("/api/v1/departments", headers=admin_headers)
    assert list_dept.status_code == 200
    depts = list_dept.json()
    assert any(d["code"] == "DSN" for d in depts)

    # Check Audit Logs
    audit_res = await client.get("/api/v1/audit-logs", headers=admin_headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) >= 1
