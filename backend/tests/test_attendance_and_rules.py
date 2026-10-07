from datetime import date
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_attendance_calculation_on_time_present(client: AsyncClient, seed_data: dict):
    # Register device for Bob
    reg_res = await client.post(
        "/api/v1/devices/register",
        json={"employee_code": "EMP001", "device_identifier": "HW-PRES-01", "hostname": "PC1"},
    )
    device_token = reg_res.json()["api_token"]

    # Shift is 09:00:00 (default grace 10m -> 09:10:00). Bob starts activity at 08:54 -> PRESENT
    sync_payload = {
        "system_events": [{"event_type": "BOOT", "timestamp": "2026-10-07T08:30:00Z"}],
        "activity_batches": [
            {
                "start_time": "2026-10-07T08:54:00Z",
                "end_time": "2026-10-07T09:00:00Z",
                "key_press_count": 250,
                "mouse_click_count": 40,
                "mouse_move_count": 600,
                "active_seconds": 360,
                "idle_seconds": 0,
            }
        ],
    }
    await client.post("/api/v1/agent/sync/batch", headers={"X-Device-Token": device_token}, json=sync_payload)

    # Check Attendance status via Admin login
    admin_login = await client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "admin123"})
    token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    att_res = await client.get("/api/v1/attendance?employee_id=" + seed_data["emp1"].id, headers=headers)
    assert att_res.status_code == 200
    records = att_res.json()
    assert len(records) == 1
    assert records[0]["status"] == "PRESENT"
    assert records[0]["active_seconds"] == 360


@pytest.mark.asyncio
async def test_attendance_calculation_late_arrival(client: AsyncClient, seed_data: dict):
    # Register device for Charlie
    reg_res = await client.post(
        "/api/v1/devices/register",
        json={"employee_code": "EMP002", "device_identifier": "HW-LATE-01", "hostname": "PC2"},
    )
    device_token = reg_res.json()["api_token"]

    # Shift is 09:00:00 (grace 10m -> 09:10). Charlie starts at 09:18 -> LATE
    sync_payload = {
        "activity_batches": [
            {
                "start_time": "2026-10-07T09:18:00Z",
                "end_time": "2026-10-07T09:25:00Z",
                "key_press_count": 80,
                "mouse_click_count": 15,
                "mouse_move_count": 200,
                "active_seconds": 400,
                "idle_seconds": 20,
            }
        ]
    }
    await client.post("/api/v1/agent/sync/batch", headers={"X-Device-Token": device_token}, json=sync_payload)

    admin_login = await client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "admin123"})
    token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    att_res = await client.get("/api/v1/attendance?employee_id=" + seed_data["emp2"].id, headers=headers)
    assert att_res.status_code == 200
    records = att_res.json()
    assert len(records) == 1
    assert records[0]["status"] == "LATE"


@pytest.mark.asyncio
async def test_star_award_evaluation(client: AsyncClient, seed_data: dict):
    # Award stars for Bob (EMP001) who was PRESENT on 2026-10-07
    reg_res = await client.post(
        "/api/v1/devices/register",
        json={"employee_code": "EMP001", "device_identifier": "HW-STAR-01", "hostname": "PC1"},
    )
    device_token = reg_res.json()["api_token"]

    await client.post(
        "/api/v1/agent/sync/batch",
        headers={"X-Device-Token": device_token},
        json={
            "activity_batches": [
                {
                    "start_time": "2026-10-07T08:50:00Z",
                    "end_time": "2026-10-07T09:00:00Z",
                    "key_press_count": 100,
                    "mouse_click_count": 20,
                    "mouse_move_count": 300,
                    "active_seconds": 600,
                    "idle_seconds": 0,
                }
            ]
        },
    )

    admin_login = await client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "admin123"})
    token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    eval_res = await client.post(
        f"/api/v1/rules/evaluate-stars/{seed_data['emp1'].id}?target_date=2026-10-07",
        headers=headers,
    )
    assert eval_res.status_code == 200
    stars = eval_res.json()
    assert len(stars) >= 1
    assert stars[0]["reason"] == "On-Time Arrival (Punctuality)"
