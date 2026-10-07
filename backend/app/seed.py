import asyncio
import io
import uuid
from datetime import date, datetime, timedelta, timezone
from PIL import Image, ImageDraw
from sqlalchemy import select
from app.database import Base, async_session_factory, engine
from app.models.activity import ActivityLog, MouseHeatmap
from app.models.attendance import Attendance, AttendanceStatusEnum
from app.models.department import Department
from app.models.device import Device
from app.models.employee import Employee, RoleEnum, StatusEnum
from app.models.rules import EmployeeStar, SettingRule
from app.models.screenshot import Screenshot
from app.models.finance import FinanceMessage, FinanceNotification
from app.services.auth import generate_device_token, hash_password
from app.services.screenshot_service import screenshot_service


def create_mock_desktop_image(title: str, subtitle: str, color_scheme: str = "blue") -> bytes:
    width, height = 1280, 720
    bg_color = (15, 23, 42)
    accent_color = (99, 102, 241) if color_scheme == "blue" else (16, 185, 129)

    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    # Top OS bar
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

    # Code lines
    for i in range(14):
        line_w = 300 + (i * 73 % 550)
        col = accent_color if i % 3 == 0 else (148, 163, 184)
        draw.rounded_rectangle([290, 120 + i * 32, 290 + line_w, 134 + i * 32], radius=3, fill=col)

    draw.text((290, height - 100), f"Session: {subtitle} | Time: {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}", fill=(100, 116, 139))

    output = io.BytesIO()
    img.save(output, format="WEBP", quality=65)
    return output.getvalue()


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        print("Seeding full enterprise team dataset...")

        # 1. Departments
        depts_data = [
            ("ENG", "Core Platform Engineering"),
            ("DSN", "Product & UX Design"),
            ("QA", "Quality Assurance & Testing"),
            ("OPS", "DevOps & Cloud Infrastructure"),
            ("MKT", "Marketing & Growth"),
            ("HR", "People Operations & HR"),
        ]
        dept_map = {}
        for code, name in depts_data:
            d = (await db.execute(select(Department).where(Department.code == code))).scalars().first()
            if not d:
                d = Department(code=code, name=name)
                db.add(d)
                await db.flush()
            dept_map[code] = d

        # 2. Managers and Admin
        admin = (await db.execute(select(Employee).where(Employee.email == "admin@tracking.local"))).scalars().first()
        if not admin:
            admin = Employee(
                employee_code="ADM001",
                name="System Administrator",
                email="admin@tracking.local",
                password_hash=hash_password("admin123"),
                role=RoleEnum.ADMIN.value,
                status=StatusEnum.ACTIVE.value,
                department_id=dept_map["ENG"].id,
            )
            db.add(admin)
            await db.flush()

        managers_data = [
            ("MGR001", "Sarah Connor", "manager@tracking.local", "manager123", "ENG"),
            ("MGR002", "David Kim", "david.kim@tracking.local", "david123", "DSN"),
            ("MGR003", "Priya Sharma", "priya.sharma@tracking.local", "priya123", "OPS"),
        ]
        mgr_map = {}
        for code, name, email, pwd, dept_code in managers_data:
            m = (await db.execute(select(Employee).where(Employee.email == email))).scalars().first()
            if not m:
                m = Employee(
                    employee_code=code,
                    name=name,
                    email=email,
                    password_hash=hash_password(pwd),
                    role=RoleEnum.MANAGER.value,
                    status=StatusEnum.ACTIVE.value,
                    department_id=dept_map[dept_code].id,
                )
                db.add(m)
                await db.flush()
            mgr_map[code] = m

        # 3. Comprehensive Employees List
        staff_data = [
            ("EMP001", "Alex Rivera", "alex@tracking.local", "alex123", "ENG", "MGR001", "alex-thinkpad", AttendanceStatusEnum.PRESENT, "08:52:00", 20400, 1800),
            ("EMP002", "Elena Rostova", "elena@tracking.local", "elena123", "ENG", "MGR001", "elena-macbook", AttendanceStatusEnum.PRESENT, "08:58:00", 18800, 1600),
            ("EMP003", "Marcus Vance", "marcus@tracking.local", "marcus123", "DSN", "MGR002", "marcus-desktop", AttendanceStatusEnum.LATE, "09:24:00", 15200, 2400),
            ("EMP004", "Maya Lin", "maya@tracking.local", "maya123", "MKT", None, "maya-workstation", AttendanceStatusEnum.PRESENT, "08:44:00", 22600, 1100),
            ("EMP005", "Liam Chen", "liam@tracking.local", "liam123", "OPS", "MGR003", "liam-dell", AttendanceStatusEnum.LATE, "09:18:00", 16200, 2200),
            ("EMP006", "Sophie Martin", "sophie@tracking.local", "sophie123", "QA", "MGR001", "sophie-laptop", AttendanceStatusEnum.OFFLINE, None, 0, 0),
            ("EMP007", "James Wilson", "james.w@tracking.local", "james123", "ENG", "MGR001", "james-dev-box", AttendanceStatusEnum.PRESENT, "08:55:00", 19500, 1400),
            ("EMP008", "Aisha Patel", "aisha.p@tracking.local", "aisha123", "ENG", "MGR001", "aisha-blade", AttendanceStatusEnum.PRESENT, "08:49:00", 21000, 1200),
            ("EMP009", "Carlos Mendez", "carlos.m@tracking.local", "carlos123", "ENG", "MGR001", "carlos-macmini", AttendanceStatusEnum.LATE, "09:15:00", 16800, 1900),
            ("EMP010", "Chloe Dubois", "chloe.d@tracking.local", "chloe123", "DSN", "MGR002", "chloe-surface", AttendanceStatusEnum.PRESENT, "08:51:00", 18200, 1500),
            ("EMP011", "Daniel Brooks", "daniel.b@tracking.local", "daniel123", "OPS", "MGR003", "daniel-rig", AttendanceStatusEnum.PRESENT, "08:46:00", 22100, 900),
            ("EMP012", "Fatima Mansoor", "fatima.m@tracking.local", "fatima123", "HR", None, "fatima-elitebook", AttendanceStatusEnum.PRESENT, "08:57:00", 17900, 1300),
            ("EMP013", "Ryan Gallagher", "ryan.g@tracking.local", "ryan123", "QA", "MGR001", "ryan-test-pc", AttendanceStatusEnum.LATE, "09:22:00", 14800, 2600),
            ("EMP014", "Zoe Takahashi", "zoe.t@tracking.local", "zoe123", "MKT", None, "zoe-macbook-air", AttendanceStatusEnum.PRESENT, "08:50:00", 19100, 1400),
        ]

        now = datetime.now(timezone.utc)
        today_date = date.today()

        for code, name, email, pwd, dept_code, mgr_code, hostname, status_enum, checkin_str, active_sec, idle_sec in staff_data:
            emp = (await db.execute(select(Employee).where(Employee.email == email))).scalars().first()
            mgr_id = mgr_map[mgr_code].id if mgr_code else None
            dept_id = dept_map[dept_code].id

            if not emp:
                emp = Employee(
                    employee_code=code,
                    name=name,
                    email=email,
                    password_hash=hash_password(pwd),
                    role=RoleEnum.EMPLOYEE.value,
                    status=StatusEnum.ACTIVE.value,
                    department_id=dept_id,
                    manager_id=mgr_id,
                )
                db.add(emp)
                await db.flush()
            else:
                emp.name = name
                emp.department_id = dept_id
                emp.manager_id = mgr_id

            # Device
            dev = (await db.execute(select(Device).where(Device.employee_id == emp.id))).scalars().first()
            if not dev:
                _, token_hash = generate_device_token()
                dev = Device(
                    employee_id=emp.id,
                    device_identifier=f"DEV-{code}",
                    hostname=f"{hostname.upper()}.CORP",
                    os_version="Windows 11 Pro 23H2",
                    agent_version="1.2.0-rust",
                    api_token_hash=token_hash,
                    last_heartbeat=now,
                    status="ACTIVE",
                )
                db.add(dev)
                await db.flush()

            # Attendance for today
            first_act = datetime.fromisoformat(f"{today_date.isoformat()}T{checkin_str}Z") if checkin_str else None
            last_act = now if first_act else None

            att = (await db.execute(select(Attendance).where(Attendance.employee_id == emp.id, Attendance.work_date == today_date))).scalars().first()
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
                    status=status_enum.value,
                    rule_eval_context={"shift_start": "09:00:00", "grace_period_minutes": 10},
                )
                db.add(att)
            else:
                att.first_activity = first_act
                att.last_activity = last_act
                att.active_seconds = active_sec
                att.idle_seconds = idle_sec
                att.status = status_enum.value

            # If active, generate activity logs, heatmaps & mock screenshots
            if active_sec > 0:
                # Activity log
                act = (await db.execute(select(ActivityLog).where(ActivityLog.employee_id == emp.id))).scalars().first()
                if not act:
                    act_log = ActivityLog(
                        employee_id=emp.id,
                        device_id=dev.id,
                        start_time=now - timedelta(hours=3),
                        end_time=now,
                        key_press_count=1850 + (abs(hash(code)) % 800),
                        mouse_click_count=420 + (abs(hash(code)) % 250),
                        mouse_move_count=8200 + (abs(hash(code)) % 3000),
                        active_seconds=active_sec,
                        idle_seconds=idle_sec,
                    )
                    db.add(act_log)

                # Realistic 20x12 Heatmap Matrix
                hm = (await db.execute(select(MouseHeatmap).where(MouseHeatmap.employee_id == emp.id))).scalars().first()
                if not hm:
                    heatmap_matrix = {}
                    # Top navigation bar & tabs (rows 0-1)
                    for c in range(1, 19):
                        heatmap_matrix[f"0,{c}"] = 25 + (c * 7 + abs(hash(code))) % 45
                        heatmap_matrix[f"1,{c}"] = 35 + (c * 9 + abs(hash(code))) % 60
                    # Left sidebar / tool palette (rows 2-9, cols 1-3)
                    for r in range(2, 10):
                        for c in range(1, 4):
                            heatmap_matrix[f"{r},{c}"] = 40 + (r * 11 + c * 5 + abs(hash(code))) % 75
                    # Central active workspace / editor (rows 3-8, cols 5-15)
                    for r in range(3, 9):
                        for c in range(5, 16):
                            weight = 60 + ((r - 5)**2 + (c - 10)**2) * 4
                            count = max(15, 140 - weight + (abs(hash(code + str(r) + str(c))) % 40))
                            heatmap_matrix[f"{r},{c}"] = count
                    # Bottom taskbar & status strip (rows 10-11, cols 0-19)
                    for c in [0, 1, 2, 8, 9, 10, 17, 18, 19]:
                        heatmap_matrix[f"11,{c}"] = 30 + (c * 8 + abs(hash(code))) % 55

                    hm_rec = MouseHeatmap(
                        employee_id=emp.id,
                        device_id=dev.id,
                        window_start=now - timedelta(hours=4),
                        window_end=now,
                        screen_width=1920,
                        screen_height=1080,
                        grid_cols=20,
                        grid_rows=12,
                        grid_matrix=heatmap_matrix,
                    )
                    db.add(hm_rec)

                # Screenshots throughout the day
                existing_ss_count = (await db.execute(select(Screenshot).where(Screenshot.employee_id == emp.id))).scalars().all()
                if len(existing_ss_count) < 2:
                    shots_config = [
                        ("09:15 AM — Morning Standup & Task Brief", "blue", timedelta(hours=3, minutes=30)),
                        ("11:30 AM — Active Feature Implementation", "blue", timedelta(hours=2)),
                        ("02:15 PM — Code Review & Architecture PR", "green", timedelta(minutes=45)),
                        ("04:30 PM — Automated Test Suite & Deploy", "green", timedelta(minutes=10)),
                    ]
                    for title_sfx, col_scheme, time_ago in shots_config:
                        img_bytes = create_mock_desktop_image(
                            title=f"{name} — {title_sfx}",
                            subtitle=f"Workstation {dev.hostname} ({dept_code})",
                            color_scheme=col_scheme,
                        )
                        await screenshot_service.save_screenshot(
                            db=db,
                            employee_id=emp.id,
                            device_id=dev.id,
                            file_bytes=img_bytes,
                            captured_at=now - time_ago,
                            format="webp",
                            width=1280,
                            height=720,
                        )

                # Star awards: Punctuality and Early Bird
                if status_enum == AttendanceStatusEnum.PRESENT:
                    # 1. Punctuality Star
                    star1 = (await db.execute(select(EmployeeStar).where(
                        EmployeeStar.employee_id == emp.id,
                        EmployeeStar.award_date == today_date,
                        EmployeeStar.reason == "On-Time Arrival (Punctuality)",
                    ))).scalars().first()
                    if not star1:
                        db.add(EmployeeStar(
                            id=str(uuid.uuid4()),
                            employee_id=emp.id,
                            award_date=today_date,
                            star_count=1,
                            reason="On-Time Arrival (Punctuality)",
                            criteria_snapshot={"status": "PRESENT", "first_activity": checkin_str},
                            awarded_at=now,
                        ))

                    # 2. Early Bird Star (if arrived before 09:00:00)
                    if checkin_str and checkin_str < "09:00:00":
                        star_early = (await db.execute(select(EmployeeStar).where(
                            EmployeeStar.employee_id == emp.id,
                            EmployeeStar.award_date == today_date,
                            EmployeeStar.reason == "Early Bird Star (Arrived Before Shift Time)",
                        ))).scalars().first()
                        if not star_early:
                            db.add(EmployeeStar(
                                id=str(uuid.uuid4()),
                                employee_id=emp.id,
                                award_date=today_date,
                                star_count=1,
                                reason="Early Bird Star (Arrived Before Shift Time)",
                                criteria_snapshot={"first_activity": checkin_str, "shift_start": "09:00:00"},
                                awarded_at=now,
                            ))

        # 5. Finance Messages and Delivery Notifications
        existing_finance = (await db.execute(select(FinanceMessage))).scalars().all()
        if len(existing_finance) == 0:
            alex_emp = (await db.execute(select(Employee).where(Employee.email == "alex@tracking.local"))).scalars().first()
            marcus_emp = (await db.execute(select(Employee).where(Employee.email == "marcus@tracking.local"))).scalars().first()
            sarah_mgr = (await db.execute(select(Employee).where(Employee.email == "manager@tracking.local"))).scalars().first()

            if alex_emp and admin:
                f_msg1 = FinanceMessage(
                    id=str(uuid.uuid4()),
                    sender_id=admin.id,
                    recipient_id=alex_emp.id,
                    recipient_name=alex_emp.name,
                    recipient_code=alex_emp.employee_code,
                    recipient_department="Core Platform Engineering",
                    subject="Q3 Performance Bonus Disbursed",
                    message="Hi Alex, your stellar engineering contribution and 100% on-time attendance this quarter have earned you a $750 performance bonus. This has been credited to your direct deposit account. Keep up the phenomenal work!",
                    amount=750.00,
                    message_type="BONUS",
                    priority="NORMAL",
                    notify_others=True,
                    is_broadcast=False,
                    is_read=False,
                    created_at=now - timedelta(hours=3),
                )
                db.add(f_msg1)
                await db.flush()

                # Recipient notification
                db.add(FinanceNotification(
                    id=str(uuid.uuid4()),
                    message_id=f_msg1.id,
                    target_user_id=alex_emp.id,
                    title="💰 Finance Notice from Admin: Q3 Performance Bonus Disbursed",
                    body=f_msg1.message,
                    notification_type="FINANCE_DIRECT",
                    is_read=False,
                    created_at=now - timedelta(hours=3),
                ))

                # Manager notification
                if sarah_mgr:
                    db.add(FinanceNotification(
                        id=str(uuid.uuid4()),
                        message_id=f_msg1.id,
                        target_user_id=sarah_mgr.id,
                        title=f"📋 Finance Update for {alex_emp.name}: Q3 Performance Bonus Disbursed",
                        body=f"Admin sent a $750 BONUS communication to {alex_emp.name} ({alex_emp.employee_code}).",
                        notification_type="MANAGER_ALERT",
                        is_read=False,
                        created_at=now - timedelta(hours=3),
                    ))

            if marcus_emp and admin:
                f_msg2 = FinanceMessage(
                    id=str(uuid.uuid4()),
                    sender_id=admin.id,
                    recipient_id=marcus_emp.id,
                    recipient_name=marcus_emp.name,
                    recipient_code=marcus_emp.employee_code,
                    recipient_department="Product & UX Design",
                    subject="UX Design Hardware Reimbursement Approved",
                    message="Hello Marcus, your hardware monitor calibration tool expense report (#EXP-4029) for $320.00 has been verified by Finance and approved. Payout scheduled for Friday payroll.",
                    amount=320.00,
                    message_type="REIMBURSEMENT",
                    priority="NORMAL",
                    notify_others=True,
                    is_broadcast=False,
                    is_read=False,
                    created_at=now - timedelta(hours=1, minutes=40),
                )
                db.add(f_msg2)
                await db.flush()

                db.add(FinanceNotification(
                    id=str(uuid.uuid4()),
                    message_id=f_msg2.id,
                    target_user_id=marcus_emp.id,
                    title="💰 Finance Notice from Admin: UX Design Hardware Reimbursement Approved",
                    body=f_msg2.message,
                    notification_type="FINANCE_DIRECT",
                    is_read=False,
                    created_at=now - timedelta(hours=1, minutes=40),
                ))

            if admin:
                f_msg3 = FinanceMessage(
                    id=str(uuid.uuid4()),
                    sender_id=admin.id,
                    recipient_id=None,
                    recipient_name="All Staff (Company Broadcast)",
                    recipient_code="ALL",
                    recipient_department="All Departments",
                    subject="Annual Merit Review & Health Benefit Adjustments",
                    message="Dear Team, all health insurance premium allowances and annual merit compensation adjustments have been processed into payroll. Please review your statements on the portal. Reach out to HR/Finance with any questions.",
                    amount=None,
                    message_type="GENERAL",
                    priority="NORMAL",
                    notify_others=True,
                    is_broadcast=True,
                    is_read=False,
                    created_at=now - timedelta(days=1),
                )
                db.add(f_msg3)
                await db.flush()

                # Broadcast to employees
                all_active = (await db.execute(select(Employee).where(Employee.status == "ACTIVE"))).scalars().all()
                for e in all_active:
                    db.add(FinanceNotification(
                        id=str(uuid.uuid4()),
                        message_id=f_msg3.id,
                        target_user_id=e.id,
                        title="📢 Company Finance Announcement: Annual Merit Review & Health Benefit Adjustments",
                        body=f_msg3.message,
                        notification_type="BROADCAST",
                        is_read=False,
                        created_at=now - timedelta(days=1),
                    ))

        await db.commit()
        print("Successfully seeded employees, attendance, heatmaps, screenshots, and enterprise finance messaging records!")


if __name__ == "__main__":
    asyncio.run(seed())
