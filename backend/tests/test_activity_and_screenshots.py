import io
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_activity_stats_and_heatmap(client: AsyncClient, seed_data: dict):
    # Register device & sync activity
    reg_res = await client.post(
        "/api/v1/devices/register",
        json={"employee_code": "EMP001", "device_identifier": "HW-HM-01", "hostname": "PC1"},
    )
    device_token = reg_res.json()["api_token"]

    await client.post(
        "/api/v1/agent/sync/batch",
        headers={"X-Device-Token": device_token},
        json={
            "activity_batches": [
                {
                    "start_time": "2026-10-07T10:00:00Z",
                    "end_time": "2026-10-07T10:05:00Z",
                    "key_press_count": 428,
                    "mouse_click_count": 71,
                    "mouse_move_count": 1942,
                    "active_seconds": 271,
                    "idle_seconds": 29,
                }
            ],
            "heatmap_batches": [
                {
                    "window_start": "2026-10-07T10:00:00Z",
                    "window_end": "2026-10-07T10:05:00Z",
                    "screen_width": 1920,
                    "screen_height": 1080,
                    "grid_cols": 20,
                    "grid_rows": 12,
                    "grid_matrix": {"1,1": 14, "1,2": 8, "1,3": 2},
                }
            ],
        },
    )

    admin_login = await client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "admin123"})
    token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Query stats
    stats_res = await client.get(
        f"/api/v1/activity/stats?employee_id={seed_data['emp1'].id}&date_from=2026-10-07T00:00:00Z&date_to=2026-10-07T23:59:59Z",
        headers=headers,
    )
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_key_presses"] == 428
    assert stats["total_mouse_clicks"] == 71
    assert stats["total_mouse_moves"] == 1942

    # Query heatmap
    hm_res = await client.get(
        f"/api/v1/activity/heatmap?employee_id={seed_data['emp1'].id}&start_time=2026-10-07T00:00:00Z&end_time=2026-10-07T23:59:59Z",
        headers=headers,
    )
    assert hm_res.status_code == 200
    hm_data = hm_res.json()
    assert hm_data["composite_matrix"]["1,1"] == 14
    assert hm_data["composite_matrix"]["1,2"] == 8


@pytest.mark.asyncio
async def test_screenshot_upload_and_listing(client: AsyncClient, seed_data: dict):
    # Register device
    reg_res = await client.post(
        "/api/v1/devices/register",
        json={"employee_code": "EMP001", "device_identifier": "HW-SS-01", "hostname": "PC1"},
    )
    device_token = reg_res.json()["api_token"]

    # Upload mock WebP image binary
    mock_image_bytes = b"RIFF\x14\x00\x00\x00WEBPVP8 \x08\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    files = {"file": ("screenshot.webp", io.BytesIO(mock_image_bytes), "image/webp")}
    data = {"captured_at": "2026-10-07T10:15:00Z", "width": 1280, "height": 720}

    upload_res = await client.post(
        "/api/v1/agent/screenshots/upload",
        headers={"X-Device-Token": device_token},
        files=files,
        data=data,
    )
    assert upload_res.status_code == 201
    ss_id = upload_res.json()["screenshot_id"]

    # List screenshots as Admin
    admin_login = await client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "admin123"})
    token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    list_res = await client.get("/api/v1/screenshots", headers=headers)
    assert list_res.status_code == 200
    gallery = list_res.json()
    assert gallery["total"] >= 1
    assert gallery["items"][0]["id"] == ss_id
