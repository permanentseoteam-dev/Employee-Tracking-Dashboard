from collections.abc import Callable
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.device import Device
from app.models.employee import Employee, RoleEnum
from app.services.auth import decode_access_token, verify_device_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Employee:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or payload.get("scope") != "user":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    stmt = select(Employee).where(Employee.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or suspended",
        )
    return user


def require_role(allowed_roles: list[RoleEnum]) -> Callable:
    async def role_checker(current_user: Employee = Depends(get_current_user)) -> Employee:
        if current_user.role not in [r.value for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )
        return current_user

    return role_checker


async def get_current_device(
    x_device_token: str = Header(..., alias="X-Device-Token"),
    db: AsyncSession = Depends(get_db),
) -> Device:
    # Query all active devices and verify token
    # Or device id could be provided via header or token verification
    stmt = select(Device).where(Device.status == "ACTIVE")
    result = await db.execute(stmt)
    devices = result.scalars().all()
    
    for device in devices:
        if verify_device_token(x_device_token, device.api_token_hash):
            return device

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid device credentials",
    )


async def get_scoped_employee_ids(
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[str] | None:
    """Returns None for ADMIN (indicating all org access),
    or a list of allowed employee UUID strings for MANAGER and EMPLOYEE."""
    if current_user.role == RoleEnum.ADMIN.value:
        return None
    elif current_user.role == RoleEnum.MANAGER.value:
        stmt = select(Employee.id).where(
            (Employee.manager_id == current_user.id) | (Employee.id == current_user.id)
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())
    else:
        # EMPLOYEE
        return [current_user.id]
