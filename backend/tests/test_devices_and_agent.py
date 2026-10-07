from datetime import datetime, timezone
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_device_registration_and_heartbeat(client: AsyncClient, seed_data: dict):
    # Register a new device for Bob (EMP001)
    reg_res = await client.post(
        "/api/v1/devices/register",
        json={
            "employee_code": "EMP001",
            "device_identifier": "HW-UUID-998877",
            "hostname": "BOB-DESKTOP",
            "os_version": "Windows 11 Pro",
            "agent_version": "1.0.0",
        },
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert "api_token" in reg_data
    assert reg_data["employee_id"] == seed_data["emp1"].id
    device_token = reg_data["api_token"]

    # Send heartbeat
    hb_res = await client.post(
        "/api/v1/agent/heartbeat",
        headers={"X-Device-Token": device_token},
        json={"agent_version": "1.0.1"},
    )
    assert hb_res.status_code == 200
    hb_data = hb_res.json()
    assert hb_data["status"] == "ok"
    assert hb_data["monitoring_active"] is True


@pytest.mark.asyncio
async def test_agent_sync_batch_ingestion(client: AsyncClient, seed_data: dict):
    # Register device
    reg_res = await client.post(
        "/api/v1/devices/register",
        json={
            "employee_code": "EMP001",
            "device_identifier": "HW-UUID-SYNC",
            "hostname": "BOB-SYNC-PC",
        },
    )
    device_token = reg_res.json()["api_token"]

    # Ingest batch
    sync_payload = {
        "system_events": [
            {"event_type": "BOOT", "timestamp": "2026-10-07T08:30:00Z"},
            {"event_type": "LOGIN", "timestamp": "2026-10-07T08:45:00Z"},
        ],
        "activity_batches": [
            {
                "start_time": "2026-10-07T08:50:00Z",
                "end_time": "2026-10-07T08:55:00Z",
                "key_press_count": 120,
                "mouse_click_count": 30,
                "mouse_move_count": 450,
                "active_seconds": 280,
                "idle_seconds": 20,
            }
        ],
        "heatmap_batches": [
            {
                "window_start": "2026-10-07T08:50:00Z",
                "window_end": "2026-10-07T08:55:00Z",
                "screen_width": 1920,
                "screen_height": 1080,
                "grid_cols": 20,
                "grid_rows": 12,
                "grid_matrix": {"0,0": 10, "5,5": 25},
            }
        ],
    }

    sync_res = await client.post(
        "/api/v1/agent/sync/batch",
        headers={"X-Device-Token": device_token},
        json=sync_payload,
    )
    assert sync_res.status_code == 200
    res_data = sync_res.json()
    assert res_data["synced_events"] == 2
    assert res_data["synced_activity_batches"] == 1
    assert res_data["synced_heatmap_batches"] == 1
