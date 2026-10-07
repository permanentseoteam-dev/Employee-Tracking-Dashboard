from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.activity import MouseHeatmap
from app.schemas.activity import HeatmapBatchItem, MouseHeatmapOut


def _to_naive_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class HeatmapService:
    @staticmethod
    async def record_heatmap_batches(
        db: AsyncSession,
        employee_id: str,
        device_id: str | None,
        batches: list[HeatmapBatchItem],
    ):
        for b in batches:
            record = MouseHeatmap(
                employee_id=employee_id,
                device_id=device_id,
                window_start=b.window_start,
                window_end=b.window_end,
                screen_width=b.screen_width,
                screen_height=b.screen_height,
                grid_cols=b.grid_cols,
                grid_rows=b.grid_rows,
                grid_matrix=b.grid_matrix,
            )
            db.add(record)

    @staticmethod
    async def get_composite_heatmap(
        db: AsyncSession,
        employee_id: str,
        start_time: datetime,
        end_time: datetime,
        grid_cols: int = 20,
        grid_rows: int = 12,
    ) -> MouseHeatmapOut:
        st = _to_naive_utc(start_time)
        et = _to_naive_utc(end_time)

        stmt = select(MouseHeatmap).where(
            MouseHeatmap.employee_id == employee_id,
        )
        if st is not None:
            stmt = stmt.where(MouseHeatmap.window_end >= st)
        if et is not None:
            stmt = stmt.where(MouseHeatmap.window_start <= et)

        result = await db.execute(stmt)
        heatmaps = result.scalars().all()

        composite: dict[str, int] = {}
        for hm in heatmaps:
            for cell_key, count in hm.grid_matrix.items():
                composite[cell_key] = composite.get(cell_key, 0) + int(count)

        return MouseHeatmapOut(
            employee_id=employee_id,
            grid_cols=grid_cols,
            grid_rows=grid_rows,
            composite_matrix=composite,
        )


heatmap_service = HeatmapService()
