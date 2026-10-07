from datetime import datetime
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.activity import ActivityLog
from app.schemas.activity import ActivityBatchItem, ActivityStatsOut


class ActivityService:
    @staticmethod
    async def record_activity_batches(
        db: AsyncSession,
        employee_id: str,
        device_id: str | None,
        batches: list[ActivityBatchItem],
    ):
        for batch in batches:
            log = ActivityLog(
                employee_id=employee_id,
                device_id=device_id,
                start_time=batch.start_time,
                end_time=batch.end_time,
                key_press_count=batch.key_press_count,
                mouse_click_count=batch.mouse_click_count,
                mouse_move_count=batch.mouse_move_count,
                active_seconds=batch.active_seconds,
                idle_seconds=batch.idle_seconds,
            )
            db.add(log)

    @staticmethod
    async def get_activity_stats(
        db: AsyncSession,
        employee_id: str,
        date_from: datetime,
        date_to: datetime,
    ) -> ActivityStatsOut:
        stmt = (
            select(
                func.coalesce(func.sum(ActivityLog.key_press_count), 0).label("keys"),
                func.coalesce(func.sum(ActivityLog.mouse_click_count), 0).label("clicks"),
                func.coalesce(func.sum(ActivityLog.mouse_move_count), 0).label("moves"),
                func.coalesce(func.sum(ActivityLog.active_seconds), 0).label("active"),
                func.coalesce(func.sum(ActivityLog.idle_seconds), 0).label("idle"),
            )
            .where(
                ActivityLog.employee_id == employee_id,
                ActivityLog.start_time >= date_from,
                ActivityLog.end_time <= date_to,
            )
        )
        result = await db.execute(stmt)
        row = result.first()
        
        return ActivityStatsOut(
            employee_id=employee_id,
            date_from=date_from,
            date_to=date_to,
            total_key_presses=int(row.keys) if row else 0,
            total_mouse_clicks=int(row.clicks) if row else 0,
            total_mouse_moves=int(row.moves) if row else 0,
            total_active_seconds=int(row.active) if row else 0,
            total_idle_seconds=int(row.idle) if row else 0,
        )


activity_service = ActivityService()
