import asyncio
import io
import uuid
from datetime import date, datetime, timedelta, timezone
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from app.database import Base, async_session_factory, engine
from app.models.activity import ActivityLog, MouseHeatmap
from app.models.attendance import Attendance, AttendanceStatusEnum
from app.models.department import Department
from app.models.device import Device
from app.models.employee import Employee, RoleEnum, StatusEnum
from app.models.rules import EmployeeStar, SettingRule
from app.models.screenshot import Screenshot
from app.services.auth import generate_device_token, hash_password
from app.services.screenshot_service import screenshot_service


def create_mock_desktop_image(title: str, subtitle: str, color_scheme: str = "blue") -> bytes:
    """Generates a realistic 1280x720 desktop mockup in WebP format."""
    width, height = 1280, 720
    bg_color = (15, 23, 42)
    accent_color = (99, 102, 241) if color_scheme == "blue" else (16, 185, 129)

    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    # Draw Top OS bar
    draw.rectangle([0, 0, width, 32], fill=(30, 41, 59))
    draw.rectangle([0, height - 42, width, height], fill=(15, 23, 42))

    # Taskbar icons
    for i in range(5):
        draw.rounded_rectangle([width // 2 - 100 + i * 40, height - 36, width // 2 - 70 + i * 40, height - 6], radius=6, fill=(51, 65, 85))

    # Main Application Window
    draw.rounded_rectangle([60, 50, width - 60, height - 60], radius=12, fill=(30, 41, 59), outline=(71, 85, 105), width=1)
    draw.rectangle([60, 50, width - 60, 90], fill=(51, 65, 85))

    # Window buttons
    draw.ellipse([80, 66, 92, 78], fill=(239, 68, 68))
    draw.ellipse([100, 66, 112, 78], fill=(245, 158, 11))
    draw.ellipse([120, 66, 132, 78], fill=(16, 185, 129))

    # Code / UI Mockup content
    draw.text((150, 64), f"WorkPulse Desktop Agent — {title}", fill=(241, 245, 249))

    # Left sidebar
    draw.rectangle([60, 90, 260, height - 60], fill=(15, 23, 42))
    for i in range(8):
        draw.rounded_rectangle([80, 110 + i * 36, 240, 134 + i * 36], radius=4, fill=(30, 41, 59))

    # Main content code lines
    for i in range(14):
        line_w = 300 + (i * 73 % 550)
        col = accent_color if i % 3 == 0 else (148, 163, 184)
        draw.rounded_rectangle([290, 120 + i * 32, 290 + line_w, 134 + i * 32], radius=3, fill=col)

    # Info footer
    draw.text((290, height - 100), f"Session: {subtitle} | Time: {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}", fill=(100, 116, 139))

    output = io.BytesIO()
    img.save(output, format="WEBP", quality=65)
    return output.getvalue()


async def seed(force: bool = False):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        today = date.today()

        # Check existing
        existing_emp = (await db.execute(select(Employee).where(Employee.email == "admin@tracking.local"))).scalars().first()
        if existing_emp and not force:
            print("Base data exists. Populating rich sample data (attendance, activity, heatmaps, screenshots, stars)...")
        else:
            print("Creating core org structure...")
            # 1. Departments
            depts = {
                "ENG": Department(name="Core Platform Engineering", code="ENG"),
                "DSN": Department(name="Product & UX Design", code="DSN"),
                "MKT": Department(name="Growth & Marketing", code="MKT"),
                "OPS": Department(name="DevOps & Infrastructure", code="OPS"),
            }
            db.add_all(depts.values())
            await db.flush()

            # 2. Admin & Manager
            admin = Employee(
                employee_code="ADM001",
                name="System Administrator",
                email="admin@tracking.local",
                password_hash=hash_password("admin123"),
                role=RoleEnum.ADMIN.value,
                status=StatusEnum.ACTIVE.value,
                department_id=depts["ENG"].id,
            )
            manager = Employee(
                employee_code="MGR001",
                name="Sarah Connor (Tech Lead)",
                email="manager@tracking.local",
                password_hash=hash_password("manager123"),
                role=RoleEnum.MANAGER.value,
                status=StatusEnum.ACTIVE.value,
                department_id=depts["ENG"].id,
            )
            db.add_all([admin, manager])
            await db.flush()

            # 3. Rules
            db.add_all([
                SettingRule(
                    rule_type="ATTENDANCE",
                    name="Standard Working Hours (09:00 - 18:00)",
                    is_active=True,
                    config_payload={"shift_start": "09:00:00", "shift_end": "18:00:00", "grace_period_minutes": 10, "minimum_active_hours_full_day": 7.0},
                ),
                SettingRule(
                    rule_type="STAR",
                    name="Performance & Punctuality Star Rules",
                    is_active=True,
                    config_payload={"punctuality_star_enabled": True, "min_active_seconds_for_star": 18000},
                ),
                SettingRule(
                    rule_type="MONITORING",
                    name="Screenshot Interval Schedule",
                    is_active=True,
                    config_payload={"interval_minutes": 10, "start_time": "09:00:00", "end_time": "18:00:00", "quality": 65, "max_width": 1280, "max_height": 720},
                ),
                SettingRule(
                    rule_type="RETENTION",
                    name="Screenshot & Log Retention Policy",
                    is_active=True,
                    config_payload={"screenshot_retention_days": 30, "activity_retention_days": 90, "attendance_retention_days": 730},
                )
            ])
            await db.flush()

        # Fetch Manager and Departments
        mgr = (await db.execute(select(Employee).where(Employee.email == "manager@tracking.local"))).scalars().first()
        eng = (await db.execute(select(Department).where(Department.code == "ENG"))).scalars().first()

        # Seed 6 diverse employees if not present
        team_members = [
            ("EMP001", "Alex Rivera", "alex@tracking.local", "alex123", eng.id, mgr.id),
            ("EMP002", "Elena Rostova", "elena@tracking.local", "elena123", eng.id, mgr.id),
            ("EMP003", "Marcus Vance", "marcus@tracking.local", "marcus123", eng.id, mgr.id),
            ("EMP004", "Maya Lin", "maya@tracking.local", "maya123", eng.id, mgr.id),
            ("EMP005", "Liam Chen", "liam@tracking.local", "liam123", eng.id, None),
            ("EMP006", "Sophie Martin", "sophie@tracking.local", "sophie123", eng.id, None),
        ]

        employee_records = []
        for code, name, email, pwd, dept_id, manager_id in team_members:
            emp = (await db.execute(select(Employee).where(Employee.email == email))).scalars().first()
            if not emp:
                emp = Employee(
                    employee_code=code,
                    name=name,
                    email=email,
                    password_hash=hash_password(pwd),
                    role=RoleEnum.EMPLOYEE.value,
                    status=StatusEnum.ACTIVE.value,
                    department_id=dept_id,
                    manager_id=manager_id,
                )
                db.add(emp)
                await db.flush()
            employee_records.append(emp)

        # Register devices & attendance for today
        now = datetime.now(timezone.utc)
        today_date = date.today()

        attendance_scenarios = [
            (employee_records[0], AttendanceStatusEnum.PRESENT, "08:52:00", 19800, 2400, "alex-thinkpad"), # Alex
            (employee_records[1], AttendanceStatusEnum.PRESENT, "08:58:00", 18200, 1900, "elena-macbook"), # Elena
            (employee_records[2], AttendanceStatusEnum.LATE, "09:24:00", 14500, 3100, "marcus-desktop"),  # Marcus
            (employee_records[3], AttendanceStatusEnum.PRESENT, "08:44:00", 22400, 1200, "maya-workstation"), # Maya
            (employee_records[4], AttendanceStatusEnum.LATE, "09:18:00", 15800, 2600, "liam-dell"),       # Liam
            (employee_records[5], AttendanceStatusEnum.OFFLINE, None, 0, 0, "sophie-laptop"),              # Sophie
        ]

        for emp, status_val, checkin_time_str, active_sec, idle_sec, host in attendance_scenarios:
            # Device
            dev = (await db.execute(select(Device).where(Device.employee_id == emp.id))).scalars().first()
            if not dev:
                _, token_hash = generate_device_token()
                dev = Device(
                    employee_id=emp.id,
                    device_identifier=f"DEV-{emp.employee_code}",
                    hostname=f"{host.upper()}.CORP",
                    os_version="Windows 11 Pro 23H2",
                    agent_version="1.2.0-rust",
                    api_token_hash=token_hash,
                    last_heartbeat=now,
                    status="ACTIVE",
                )
                db.add(dev)
                await db.flush()

            # Daily Attendance
            att = (await db.execute(select(Attendance).where(Attendance.employee_id == emp.id, Attendance.work_date == today_date))).scalars().first()
            first_act = datetime.fromisoformat(f"{today_date.isoformat()}T{checkin_time_str}Z") if checkin_time_str else None
            last_act = now if first_act else None

            if not att:
                att = Attendance(
                    employee_id=emp.id,
                    work_date=today_date,
                    boot_time=first_act - timedelta(minutes=15) if first_act else None,
                    login_time=first_act - timedelta(minutes=5) if first_act else None,
                    first_activity=first_act,
                    last_activity=last_act,
                    active_seconds=active_sec,
                    idle_seconds=idle_sec,
                    status=status_val.value,
                    rule_eval_context={"shift_start": "09:00:00", "grace_period_minutes": 10},
                )
                db.add(att)
            else:
                att.first_activity = first_act
                att.last_activity = last_act
                att.active_seconds = active_sec
                att.idle_seconds = idle_sec
                att.status = status_val.value

            # If active, create sample activity batches & mouse heatmap
            if active_sec > 0:
                # Activity log
                act_log = ActivityLog(
                    employee_id=emp.id,
                    device_id=dev.id,
                    start_time=now - timedelta(minutes=30),
                    end_time=now,
                    key_press_count=320 + (emp.employee_code.__hash__() % 400),
                    mouse_click_count=64 + (emp.employee_code.__hash__() % 80),
                    mouse_move_count=1850 + (emp.employee_code.__hash__() % 900),
                    active_seconds=1600,
                    idle_seconds=200,
                )
                db.add(act_log)

                # Mouse Heatmap (20x12 grid)
                heatmap_matrix = {
                    "1,2": 14, "2,2": 28, "2,3": 35, "3,5": 19,
                    "5,8": 48, "6,8": 54, "6,9": 31, "4,10": 22,
                    "7,14": 41, "8,15": 63, "9,15": 27, "0,0": 9,
                }
                hm = MouseHeatmap(
                    employee_id=emp.id,
                    device_id=dev.id,
                    window_start=now - timedelta(minutes=30),
                    window_end=now,
                    screen_width=1920,
                    screen_height=1080,
                    grid_cols=20,
                    grid_rows=12,
                    grid_matrix=heatmap_matrix,
                )
                db.add(hm)

                # Star reward if present
                if status_val == AttendanceStatusEnum.PRESENT:
                    star_exists = (await db.execute(select(EmployeeStar).where(EmployeeStar.employee_id == emp.id, EmployeeStar.award_date == today_date))).scalars().first()
                    if not star_exists:
                        star = EmployeeStar(
                            id=str(uuid.uuid4()),
                            employee_id=emp.id,
                            award_date=today_date,
                            star_count=1,
                            reason="On-Time Arrival (Punctuality)",
                            criteria_snapshot={"status": "PRESENT", "first_activity": checkin_time_str},
                            awarded_at=now,
                        )
                        db.add(star)

                # Create Mock Screenshot in storage
                existing_ss = (await db.execute(select(Screenshot).where(Screenshot.employee_id == emp.id))).scalars().first()
                if not existing_ss:
                    img_bytes = create_mock_desktop_image(
                        title=f"{emp.name} — IDE Workspace",
                        subtitle=f"VS Code & Chromium on {dev.hostname}",
                        color_scheme="green" if status_val == AttendanceStatusEnum.PRESENT else "blue"
                    )
                    await screenshot_service.save_screenshot(
                        db=db,
                        employee_id=emp.id,
                        device_id=dev.id,
                        file_bytes=img_bytes,
                        captured_at=now - timedelta(minutes=10),
                        format="webp",
                        width=1280,
                        height=720,
                    )

        await db.commit()
        print("Successfully seeded rich dummy data: 6 staff members, active attendance, activity batches, 20x12 heatmaps, screenshots, and stars!")


if __name__ == "__main__":
    asyncio.run(seed(force=False))
