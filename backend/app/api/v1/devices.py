from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import require_role
from app.database import get_db
from app.models.device import Device
from app.models.employee import Employee, RoleEnum
from app.schemas.device import DeviceOut, DeviceRegisterRequest, DeviceRegisterResponse
from app.services.auth import generate_device_token

router = APIRouter(prefix="/devices", tags=["Devices"])


@router.post("/register", response_model=DeviceRegisterResponse)
async def register_device(payload: DeviceRegisterRequest, db: AsyncSession = Depends(get_db)):
    # Find employee by code
    stmt = select(Employee).where(Employee.employee_code == payload.employee_code)
    emp = (await db.execute(stmt)).scalars().first()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with code '{payload.employee_code}' not found",
        )

    raw_token, token_hash = generate_device_token()

    # Check if device already registered
    dev_stmt = select(Device).where(Device.device_identifier == payload.device_identifier)
    device = (await db.execute(dev_stmt)).scalars().first()

    if device:
        # Re-register / update device
        device.employee_id = emp.id
        device.hostname = payload.hostname
        device.os_version = payload.os_version
        device.agent_version = payload.agent_version
        device.api_token_hash = token_hash
        device.status = "ACTIVE"
    else:
        device = Device(
            employee_id=emp.id,
            device_identifier=payload.device_identifier,
            hostname=payload.hostname,
            os_version=payload.os_version,
            agent_version=payload.agent_version,
            api_token_hash=token_hash,
            status="ACTIVE",
        )
        db.add(device)

    await db.flush()

    return DeviceRegisterResponse(
        device_id=device.id,
        employee_id=emp.id,
        api_token=raw_token,
        registered_at=device.registered_at,
    )


@router.get("", response_model=list[DeviceOut])
async def list_devices(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role([RoleEnum.ADMIN])),
):
    stmt = select(Device).order_by(Device.registered_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.put("/{device_id}/revoke")
async def revoke_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role([RoleEnum.ADMIN])),
):
    stmt = select(Device).where(Device.id == device_id)
    device = (await db.execute(stmt)).scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device.status = "REVOKED"
    return {"status": "revoked", "device_id": device_id}
