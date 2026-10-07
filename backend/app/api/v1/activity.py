from datetime import datetime, time, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_scoped_employee_ids
from app.database import get_db
from app.schemas.activity import ActivityStatsOut, MouseHeatmapOut
from app.services.activity_service import activity_service
from app.services.heatmap_service import heatmap_service

router = APIRouter(prefix="/activity", tags=["Activity & Heatmaps"])


@router.get("/stats", response_model=ActivityStatsOut)
async def get_activity_stats(
    employee_id: str,
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    scoped_ids: list[str] | None = Depends(get_scoped_employee_ids),
):
    if scoped_ids is not None and employee_id not in scoped_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot view activity outside your permitted scope",
        )

    now = datetime.now(timezone.utc)
    from_dt = date_from or (now - timedelta(days=1))
    to_dt = date_to or now

    return await activity_service.get_activity_stats(db, employee_id, from_dt, to_dt)


@router.get("/heatmap", response_model=MouseHeatmapOut)
async def get_mouse_heatmap(
    employee_id: str,
    start_time: datetime | None = Query(None),
    end_time: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    scoped_ids: list[str] | None = Depends(get_scoped_employee_ids),
):
    if scoped_ids is not None and employee_id not in scoped_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot view heatmap outside your permitted scope",
        )

    now = datetime.now(timezone.utc)
    from_dt = start_time or (now - timedelta(days=1))
    to_dt = end_time or now

    return await heatmap_service.get_composite_heatmap(db, employee_id, from_dt, to_dt)
