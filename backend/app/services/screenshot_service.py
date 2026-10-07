import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.employee import Employee
from app.models.rules import SettingRule
from app.models.screenshot import Screenshot
from app.schemas.screenshot import PaginatedScreenshots, ScreenshotOut
from app.services.storage import storage_service


def _to_naive_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class ScreenshotService:
    @staticmethod
    async def save_screenshot(
        db: AsyncSession,
        employee_id: str,
        device_id: str | None,
        file_bytes: bytes,
        captured_at: datetime,
        format: str = "webp",
        width: int = 1280,
        height: int = 720,
    ) -> Screenshot:
        file_uuid = str(uuid.uuid4())
        date_str = captured_at.strftime("%Y-%m-%d")
        storage_key = f"screenshots/{employee_id}/{date_str}/{file_uuid}.{format}"

        # Save to storage (local or s3)
        await storage_service.save_file(file_bytes, storage_key)

        screenshot = Screenshot(
            id=file_uuid,
            employee_id=employee_id,
            device_id=device_id,
            s3_key=storage_key,
            file_size_bytes=len(file_bytes),
            format=format,
            width=width,
            height=height,
            captured_at=captured_at,
        )
        db.add(screenshot)
        await db.flush()
        return screenshot

    @staticmethod
    async def list_screenshots(
        db: AsyncSession,
        employee_ids: list[str] | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        page: int = 1,
        limit: int = 24,
        base_url: str = "",
    ) -> PaginatedScreenshots:
        stmt = select(Screenshot, Employee.name.label("emp_name")).join(
            Employee, Screenshot.employee_id == Employee.id, isouter=True
        )

        st = _to_naive_utc(date_from)
        et = _to_naive_utc(date_to)

        if employee_ids:
            stmt = stmt.where(Screenshot.employee_id.in_(employee_ids))
        if st:
            stmt = stmt.where(Screenshot.captured_at >= st)
        if et:
            stmt = stmt.where(Screenshot.captured_at <= et)

        # Count total
        count_stmt = select(func.count(Screenshot.id))
        if employee_ids:
            count_stmt = count_stmt.where(Screenshot.employee_id.in_(employee_ids))
        if st:
            count_stmt = count_stmt.where(Screenshot.captured_at >= st)
        if et:
            count_stmt = count_stmt.where(Screenshot.captured_at <= et)

        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        # Pagination & ordering
        stmt = stmt.order_by(Screenshot.captured_at.desc()).offset((page - 1) * limit).limit(limit)
        result = await db.execute(stmt)
        rows = result.all()

        items = []
        for s, emp_name in rows:
            image_url = storage_service.get_public_or_signed_url(s.s3_key, base_url=base_url)
            items.append(
                ScreenshotOut(
                    id=s.id,
                    employee_id=s.employee_id,
                    employee_name=emp_name,
                    device_id=s.device_id,
                    s3_key=s.s3_key,
                    image_url=image_url,
                    file_size_bytes=s.file_size_bytes,
                    format=s.format,
                    width=s.width,
                    height=s.height,
                    captured_at=s.captured_at,
                    created_at=s.created_at,
                )
            )

        total_pages = (total + limit - 1) // limit if total > 0 else 1
        return PaginatedScreenshots(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )

    @staticmethod
    async def purge_expired_screenshots(db: AsyncSession, retention_days: int | None = None) -> int:
        if retention_days is None:
            # Check DB rule
            stmt = select(SettingRule).where(
                SettingRule.rule_type == "RETENTION",
                SettingRule.is_active == True,
            )
            res = await db.execute(stmt)
            rule = res.scalars().first()
            retention_days = rule.config_payload.get("screenshot_retention_days", 30) if rule else 30

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
        stmt = select(Screenshot).where(Screenshot.captured_at < cutoff_date)
        res = await db.execute(stmt)
        expired_screenshots = res.scalars().all()

        purged_count = 0
        for s in expired_screenshots:
            await storage_service.delete_file(s.s3_key)
            await db.delete(s)
            purged_count += 1

        return purged_count


screenshot_service = ScreenshotService()
