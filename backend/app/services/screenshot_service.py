import io
import random
import uuid
from datetime import datetime, timedelta, timezone
from PIL import Image, ImageDraw
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.device import Device
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


def create_mock_desktop_image(title: str, subtitle: str, color_scheme: str = "blue") -> bytes:
    width, height = 1280, 720
    bg_color = (15, 23, 42)
    accent_color = (99, 102, 241) if color_scheme == "blue" else (16, 185, 129)

    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    # Top OS taskbar
    draw.rectangle([0, 0, width, 32], fill=(30, 41, 59))
    draw.rectangle([0, height - 42, width, height], fill=(15, 23, 42))

    for i in range(5):
        draw.rounded_rectangle([width // 2 - 100 + i * 40, height - 36, width // 2 - 70 + i * 40, height - 6], radius=6, fill=(51, 65, 85))

    # Window
    draw.rounded_rectangle([60, 50, width - 60, height - 60], radius=12, fill=(30, 41, 59), outline=(71, 85, 105), width=1)
    draw.rectangle([60, 50, width - 60, 90], fill=(51, 65, 85))

    draw.ellipse([80, 66, 92, 78], fill=(239, 68, 68))
    draw.ellipse([100, 66, 112, 78], fill=(245, 158, 11))
    draw.ellipse([120, 66, 132, 78], fill=(16, 185, 129))

    draw.text((150, 64), f"WorkPulse Desktop Agent — {title}", fill=(241, 245, 249))

    # Sidebar
    draw.rectangle([60, 90, 260, height - 60], fill=(15, 23, 42))
    for i in range(8):
        draw.rounded_rectangle([80, 110 + i * 36, 240, 134 + i * 36], radius=4, fill=(30, 41, 59))

    # Code/Task lines
    for i in range(14):
        line_w = 300 + (i * 73 % 550)
        col = accent_color if i % 3 == 0 else (148, 163, 184)
        draw.rounded_rectangle([290, 120 + i * 32, 290 + line_w, 134 + i * 32], radius=3, fill=col)

    draw.text((290, height - 100), f"Session: {subtitle} | Time: {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}", fill=(100, 116, 139))

    output = io.BytesIO()
    img.save(output, format="WEBP", quality=65)
    return output.getvalue()



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

    @staticmethod
    async def delete_screenshot(db: AsyncSession, screenshot_id: str) -> bool:
        stmt = select(Screenshot).where(Screenshot.id == screenshot_id)
        res = await db.execute(stmt)
        s = res.scalars().first()
        if not s:
            return False

        await storage_service.delete_file(s.s3_key)
        await db.delete(s)
        await db.flush()
        return True

    @staticmethod
    async def delete_screenshots(db: AsyncSession, employee_id: str | None = None) -> int:
        stmt = select(Screenshot)
        if employee_id:
            stmt = stmt.where(Screenshot.employee_id == employee_id)
        res = await db.execute(stmt)
        screenshots = res.scalars().all()

        deleted_count = 0
        for s in screenshots:
            await storage_service.delete_file(s.s3_key)
            await db.delete(s)
            deleted_count += 1

        await db.flush()
        return deleted_count

    @staticmethod
    async def capture_or_generate_screenshot(
        db: AsyncSession,
        employee_id: str | None = None,
        title: str | None = None,
        base_url: str = "",
    ) -> ScreenshotOut:
        emp = None
        if employee_id:
            emp = (await db.execute(select(Employee).where(Employee.id == employee_id))).scalars().first()

        if not emp:
            # Fall back to first active employee
            emp = (await db.execute(select(Employee).where(Employee.status == "ACTIVE").order_by(Employee.employee_code))).scalars().first()

        if not emp:
            # If no active employee, pick any
            emp = (await db.execute(select(Employee).order_by(Employee.id))).scalars().first()

        if not emp:
            raise ValueError("No employee found to attach screenshot")

        # Find device if available
        device = (await db.execute(select(Device).where(Device.employee_id == emp.id))).scalars().first()
        device_id = device.id if device else None
        hostname = device.hostname if device else "DESKTOP-AGENT"

        now = datetime.now(timezone.utc)
        color = random.choice(["blue", "green"])
        title_text = title or f"{emp.name} — Live Workstation Activity"
        subtitle_text = f"Workstation {hostname} ({emp.employee_code})"

        img_bytes = create_mock_desktop_image(
            title=title_text,
            subtitle=subtitle_text,
            color_scheme=color,
        )

        screenshot = await ScreenshotService.save_screenshot(
            db=db,
            employee_id=emp.id,
            device_id=device_id,
            file_bytes=img_bytes,
            captured_at=now,
            format="webp",
            width=1280,
            height=720,
        )

        image_url = storage_service.get_public_or_signed_url(screenshot.s3_key, base_url=base_url)

        return ScreenshotOut(
            id=screenshot.id,
            employee_id=screenshot.employee_id,
            employee_name=emp.name,
            device_id=screenshot.device_id,
            s3_key=screenshot.s3_key,
            image_url=image_url,
            file_size_bytes=screenshot.file_size_bytes,
            format=screenshot.format,
            width=screenshot.width,
            height=screenshot.height,
            captured_at=screenshot.captured_at,
            created_at=screenshot.created_at,
        )

    @staticmethod
    async def get_screenshot_interval(db: AsyncSession) -> dict:
        stmt = select(SettingRule).where(
            SettingRule.rule_type == "SCREENSHOT",
            SettingRule.is_active == True,
        )
        res = await db.execute(stmt)
        rule = res.scalars().first()
        interval = 10
        if rule and rule.config_payload:
            interval = rule.config_payload.get("screenshot_interval_minutes", 10)
        return {
            "interval_minutes": max(5, min(60, int(interval))),
            "interval_seconds": max(5, min(60, int(interval))) * 60,
            "min_minutes": 5,
            "max_minutes": 60,
        }

    @staticmethod
    async def set_screenshot_interval(db: AsyncSession, interval_minutes: int) -> dict:
        # Enforce range between 5 minutes and 60 minutes (1 hour)
        bounded_interval = max(5, min(60, int(interval_minutes)))
        stmt = select(SettingRule).where(SettingRule.rule_type == "SCREENSHOT")
        res = await db.execute(stmt)
        rule = res.scalars().first()

        config = {
            "screenshot_interval_minutes": bounded_interval,
            "screenshot_interval_seconds": bounded_interval * 60,
            "screenshot_quality": 65,
        }

        if rule:
            payload = dict(rule.config_payload or {})
            payload.update(config)
            rule.config_payload = payload
            rule.is_active = True
        else:
            rule = SettingRule(
                name="Screenshot Capture Interval Policy",
                description=f"Automated desktop screenshot capture interval configured to {bounded_interval} minutes (5m-1h range).",
                rule_type="SCREENSHOT",
                is_active=True,
                config_payload=config,
            )
            db.add(rule)

        await db.flush()
        return {
            "status": "success",
            "interval_minutes": bounded_interval,
            "interval_seconds": bounded_interval * 60,
            "message": f"Screenshot capture interval set to {bounded_interval} minutes.",
        }


screenshot_service = ScreenshotService()

