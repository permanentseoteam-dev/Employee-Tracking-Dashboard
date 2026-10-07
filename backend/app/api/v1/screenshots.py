from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_scoped_employee_ids, require_role
from app.database import get_db
from app.models.employee import Employee, RoleEnum
from app.schemas.screenshot import PaginatedScreenshots
from app.services.screenshot_service import screenshot_service
from app.services.storage import storage_service

router = APIRouter(prefix="/screenshots", tags=["Screenshots"])


@router.get("", response_model=PaginatedScreenshots)
async def list_screenshots(
    request: Request,
    employee_id: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    scoped_ids: list[str] | None = Depends(get_scoped_employee_ids),
):
    target_emp_ids = None
    if scoped_ids is not None:
        if employee_id:
            if employee_id not in scoped_ids:
                return PaginatedScreenshots(items=[], total=0, page=page, limit=limit, total_pages=1)
            target_emp_ids = [employee_id]
        else:
            target_emp_ids = scoped_ids
    elif employee_id:
        target_emp_ids = [employee_id]

    base_url = str(request.base_url).rstrip("/")
    return await screenshot_service.list_screenshots(
        db=db,
        employee_ids=target_emp_ids,
        date_from=date_from,
        date_to=date_to,
        page=page,
        limit=limit,
        base_url=base_url,
    )


@router.get("/file/{file_path:path}")
async def stream_screenshot_file(
    file_path: str,
):
    """Local file streamer endpoint for dev/local setups and HTML img tags."""
    data = await storage_service.get_file_bytes(file_path)
    if not data:
        raise HTTPException(status_code=404, detail="Screenshot file not found")

    media_type = "image/webp"
    if file_path.endswith(".jpg") or file_path.endswith(".jpeg"):
        media_type = "image/jpeg"

    return Response(content=data, media_type=media_type)


@router.post("/retention/purge")
async def purge_retention(
    retention_days: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role([RoleEnum.ADMIN])),
):
    purged = await screenshot_service.purge_expired_screenshots(db, retention_days=retention_days)
    return {"status": "success", "purged_screenshots": purged}


@router.delete("/{screenshot_id}")
async def delete_single_screenshot(
    screenshot_id: str,
    db: AsyncSession = Depends(get_db),
    _user: Employee = Depends(require_role([RoleEnum.ADMIN, RoleEnum.MANAGER])),
):
    success = await screenshot_service.delete_screenshot(db, screenshot_id)
    if not success:
        raise HTTPException(status_code=404, detail="Screenshot not found")
    return {"status": "success", "message": "Screenshot deleted successfully"}


@router.delete("")
async def delete_multiple_screenshots(
    employee_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: Employee = Depends(require_role([RoleEnum.ADMIN, RoleEnum.MANAGER])),
):
    deleted_count = await screenshot_service.delete_screenshots(db, employee_id=employee_id)
    return {"status": "success", "deleted_count": deleted_count, "message": f"Successfully deleted {deleted_count} screenshots"}

