from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_device
from app.database import get_db
from app.models.device import Device
from app.schemas.activity import AgentSyncPayload, AgentSyncResponse
from app.schemas.device import DeviceHeartbeatRequest
from app.schemas.screenshot import ScreenshotUploadResponse
from app.services.activity_service import activity_service
from app.services.attendance_engine import attendance_engine
from app.services.heatmap_service import heatmap_service
from app.services.screenshot_service import screenshot_service

router = APIRouter(prefix="/agent", tags=["Agent Ingestion"])


@router.post("/heartbeat")
async def agent_heartbeat(
    payload: DeviceHeartbeatRequest | None = None,
    current_device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
):
    current_device.last_heartbeat = datetime.now(timezone.utc)
    if payload and payload.agent_version:
        current_device.agent_version = payload.agent_version
    return {
        "status": "ok",
        "device_id": current_device.id,
        "employee_id": current_device.employee_id,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "sync_interval_seconds": 300,
        "monitoring_active": True,
    }


@router.post("/sync/batch", response_model=AgentSyncResponse)
async def agent_sync_batch(
    payload: AgentSyncPayload,
    current_device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
):
    emp_id = current_device.employee_id
    dev_id = current_device.id

    # 1. Process System Events (Boot, Login, etc.)
    if payload.system_events:
        await attendance_engine.process_system_events(db, emp_id, payload.system_events)

    # 2. Process Activity Batches for Attendance & Activity Logs
    if payload.activity_batches:
        await attendance_engine.process_activity_for_attendance(db, emp_id, payload.activity_batches)
        await activity_service.record_activity_batches(db, emp_id, dev_id, payload.activity_batches)

    # 3. Process Heatmap Batches
    if payload.heatmap_batches:
        await heatmap_service.record_heatmap_batches(db, emp_id, dev_id, payload.heatmap_batches)

    return AgentSyncResponse(
        status="ok",
        synced_events=len(payload.system_events),
        synced_activity_batches=len(payload.activity_batches),
        synced_heatmap_batches=len(payload.heatmap_batches),
    )


@router.post("/screenshots/upload", response_model=ScreenshotUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_screenshot(
    file: UploadFile = File(...),
    captured_at: str | None = Form(None),
    width: int = Form(1280),
    height: int = Form(720),
    current_device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
):
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty screenshot file uploaded")

    if captured_at:
        try:
            capture_dt = datetime.fromisoformat(captured_at)
        except ValueError:
            capture_dt = datetime.now(timezone.utc)
    else:
        capture_dt = datetime.now(timezone.utc)

    # Determine format
    fmt = "webp"
    if file.filename and file.filename.endswith(".jpg") or file.filename.endswith(".jpeg"):
        fmt = "jpeg"

    screenshot = await screenshot_service.save_screenshot(
        db=db,
        employee_id=current_device.employee_id,
        device_id=current_device.id,
        file_bytes=file_bytes,
        captured_at=capture_dt,
        format=fmt,
        width=width,
        height=height,
    )

    return ScreenshotUploadResponse(
        screenshot_id=screenshot.id,
        employee_id=screenshot.employee_id,
        s3_key=screenshot.s3_key,
        captured_at=screenshot.captured_at,
        file_size_bytes=screenshot.file_size_bytes,
    )
