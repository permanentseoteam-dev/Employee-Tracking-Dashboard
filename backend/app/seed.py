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
from app.models.task_sheet import TaskSheet, TaskItem, TaskSheetStatusEnum, TaskPriorityEnum, TaskStatusEnum
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

        # 4b. Multi-day Historical Compliance Data for Performance Scorecards (Alex Rivera & Sarah Connor)
        alex_emp_obj = (await db.execute(select(Employee).where(Employee.email == "alex@tracking.local"))).scalars().first()
        sarah_mgr_obj = (await db.execute(select(Employee).where(Employee.email == "manager@tracking.local"))).scalars().first()

        history_items = []
        if alex_emp_obj:
            # Yesterday: Alex was LATE (Violation)
            yest = today_date - timedelta(days=1)
            history_items.append((alex_emp_obj.id, yest, AttendanceStatusEnum.LATE, "09:28:00", 17200, 2400, []))
            # 2 days ago: Alex was On-Time + Early Bird (2 Stars)
            day2 = today_date - timedelta(days=2)
            history_items.append((alex_emp_obj.id, day2, AttendanceStatusEnum.PRESENT, "08:48:00", 23000, 1500, [
                ("On-Time Arrival (Punctuality)", 1),
                ("Early Bird Star (Arrived Before Shift Time)", 1),
                ("High Daily Engagement & Activity", 1)
            ]))
            # 3 days ago: Alex was On-Time (1 Star)
            day3 = today_date - timedelta(days=3)
            history_items.append((alex_emp_obj.id, day3, AttendanceStatusEnum.PRESENT, "08:53:00", 21000, 1600, [
                ("On-Time Arrival (Punctuality)", 1)
            ]))

        if sarah_mgr_obj:
            # Today: Sarah on-time
            history_items.append((sarah_mgr_obj.id, today_date, AttendanceStatusEnum.PRESENT, "08:42:00", 24000, 1200, [
                ("On-Time Arrival (Punctuality)", 1),
                ("Early Bird Star (Arrived Before Shift Time)", 1)
            ]))
            # Yesterday: Sarah on-time
            yest = today_date - timedelta(days=1)
            history_items.append((sarah_mgr_obj.id, yest, AttendanceStatusEnum.PRESENT, "08:40:00", 23500, 1400, [
                ("On-Time Arrival (Punctuality)", 1),
                ("Early Bird Star (Arrived Before Shift Time)", 1)
            ]))
            # 2 days ago: Sarah was LATE (Violation)
            day2 = today_date - timedelta(days=2)
            history_items.append((sarah_mgr_obj.id, day2, AttendanceStatusEnum.LATE, "09:22:00", 16800, 2200, []))

        for target_id, target_date, stat_enum, check_time, a_sec, i_sec, stars_to_award in history_items:
            existing_att = (await db.execute(select(Attendance).where(Attendance.employee_id == target_id, Attendance.work_date == target_date))).scalars().first()
            if not existing_att:
                f_act = datetime.fromisoformat(f"{target_date.isoformat()}T{check_time}Z") if check_time else None
                db.add(Attendance(
                    employee_id=target_id,
                    work_date=target_date,
                    boot_time=f_act - timedelta(minutes=15) if f_act else None,
                    login_time=f_act - timedelta(minutes=5) if f_act else None,
                    first_activity=f_act,
                    last_activity=f_act + timedelta(seconds=a_sec) if f_act else None,
                    active_seconds=a_sec,
                    idle_seconds=i_sec,
                    status=stat_enum.value,
                    rule_eval_context={"shift_start": "09:00:00", "grace_period_minutes": 15},
                ))
            for s_reason, s_cnt in stars_to_award:
                s_exist = (await db.execute(select(EmployeeStar).where(EmployeeStar.employee_id == target_id, EmployeeStar.award_date == target_date, EmployeeStar.reason == s_reason))).scalars().first()
                if not s_exist:
                    db.add(EmployeeStar(
                        id=str(uuid.uuid4()),
                        employee_id=target_id,
                        award_date=target_date,
                        star_count=s_cnt,
                        reason=s_reason,
                        criteria_snapshot={"status": stat_enum.value, "first_activity": check_time},
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

        # 8. Daily Task Sheets & Tasks for Employees
        print("Seeding employee daily task sheets and task items...")
        yesterday_date = today_date - timedelta(days=1)
        two_days_ago = today_date - timedelta(days=2)
        three_days_ago = today_date - timedelta(days=3)

        sarah_mgr = (await db.execute(select(Employee).where(Employee.email == "manager@tracking.local"))).scalars().first()
        david_mgr = (await db.execute(select(Employee).where(Employee.email == "david.kim@tracking.local"))).scalars().first()
        priya_mgr = (await db.execute(select(Employee).where(Employee.email == "priya.sharma@tracking.local"))).scalars().first()

        alex_emp = (await db.execute(select(Employee).where(Employee.email == "alex@tracking.local"))).scalars().first()
        elena_emp = (await db.execute(select(Employee).where(Employee.email == "elena@tracking.local"))).scalars().first()
        marcus_emp = (await db.execute(select(Employee).where(Employee.email == "marcus@tracking.local"))).scalars().first()
        aisha_emp = (await db.execute(select(Employee).where(Employee.email == "aisha.p@tracking.local"))).scalars().first()
        james_emp = (await db.execute(select(Employee).where(Employee.email == "james.w@tracking.local"))).scalars().first()
        carlos_emp = (await db.execute(select(Employee).where(Employee.email == "carlos.m@tracking.local"))).scalars().first()
        sophie_emp = (await db.execute(select(Employee).where(Employee.email == "sophie@tracking.local"))).scalars().first()
        ryan_emp = (await db.execute(select(Employee).where(Employee.email == "ryan.g@tracking.local"))).scalars().first()
        chloe_emp = (await db.execute(select(Employee).where(Employee.email == "chloe.d@tracking.local"))).scalars().first()
        liam_emp = (await db.execute(select(Employee).where(Employee.email == "liam@tracking.local"))).scalars().first()

        sheets_seed_plan = [
            # Alex Rivera - Today
            (alex_emp, today_date, TaskSheetStatusEnum.SUBMITTED.value, 
             "Completed frontend sheet integration and bugfixes for auth tokens. Starting unit tests.", 
             "Waiting on staging mock socket server for multi-client sync tests.", sarah_mgr, "Terrific progress on the task sheets controller Alex! The responsive layout and review flow look great.", [
                ("Implement Daily Task Sheet UI and Card Grids", "Built modern interactive cards and responsive grid layout for multi-employee daily task management.", "Frontend Development", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 3.5, None),
                ("JWT Session Auto-refresh Hook", "Created automatic token refresh interceptor for expiring bearer credentials.", "Security & Auth", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 2.0, None),
                ("Refactor Employee Switcher Dropdown", "Added quick role switching synchronization and badge color indicators.", "Frontend Development", TaskPriorityEnum.LOW.value, TaskStatusEnum.COMPLETED.value, 1.0, None),
                ("End-to-End WebSocket Sync Tests", "Testing live desktop agent sync and payload dispatching.", "Testing & QA", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.IN_PROGRESS.value, 1.0, "Waiting on staging mock socket server"),
            ]),
            # Alex Rivera - Yesterday
            (alex_emp, yesterday_date, TaskSheetStatusEnum.APPROVED.value,
             "Finished attendance roll call audit and KPI calculation improvements.",
             None, sarah_mgr, "Great work on the attendance calculations and query optimizations Alex!", [
                ("Attendance KPI Query Optimization", "Added subqueries for punctual and late check-in metrics.", "Backend API", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 4.0, None),
                ("Rules Admin Inspector UI", "Designed scorecard breakdown table and penalty deduction list.", "UI/UX Design", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 3.0, None),
            ]),
            # Alex Rivera - 2 Days Ago
            (alex_emp, two_days_ago, TaskSheetStatusEnum.APPROVED.value,
             "Benchmarked SQLite WAL mode under concurrent screenshot ingestion workloads.",
             None, sarah_mgr, "Excellent performance profiling. Database write latency dropped noticeably.", [
                ("SQLite WAL PRAGMA Configuration", "Tuned synchronous PRAGMA and checkpoint intervals.", "Database & Backend", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 4.5, None),
                ("Async Database Session Pool Metrics", "Added telemetry counters for active and idle SQLAlchemy sessions.", "Core Platform", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 3.0, None),
            ]),
            # Alex Rivera - 3 Days Ago
            (alex_emp, three_days_ago, TaskSheetStatusEnum.APPROVED.value,
             "Refactored screenshot carousel keyboard navigation and full-screen lightbox.",
             None, sarah_mgr, "Very clean UI implementation. Modal UX is smooth.", [
                ("Lightbox Fullscreen Keyboard Shortcuts", "Added Left/Right arrow handlers and Escape key binding.", "Frontend Development", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 4.0, None),
                ("Custom Interval Screenshot Scheduler", "Built interval selection dropdown with 1m, 5m, 10m, 15m presets.", "Frontend Development", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 4.0, None),
            ]),

            # Elena Rostova - Today
            (elena_emp, today_date, TaskSheetStatusEnum.APPROVED.value,
             "Finished Rust Agent memory leak profiling and batch queue buffering.",
             None, sarah_mgr, "Outstanding efficiency Elena! Memory footprint is down 40%.", [
                ("Rust Agent Memory Allocation Audit", "Profiled heap allocation in raw desktop mouse tracking buffer.", "Core Platform", TaskPriorityEnum.URGENT.value, TaskStatusEnum.COMPLETED.value, 3.5, None),
                ("Batch Queue Flush Throttling", "Implemented 5-minute debounced flush to reduce server load.", "Backend Architecture", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 2.5, None),
                ("CI/CD Cross-compilation for Windows x64", "Automated cargo build target artifacts in GitHub Actions.", "DevOps", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 1.5, None),
            ]),
            # Elena Rostova - Yesterday
            (elena_emp, yesterday_date, TaskSheetStatusEnum.APPROVED.value,
             "Investigated raw mouse event jitter filter on high-polling gaming mice.",
             None, sarah_mgr, "Solid filtering algorithm Elena. Jitter is eliminated.", [
                ("Low-pass Event Coordinate Filter", "Applied weighted smoothing average to prevent synthetic micro-jitters.", "Core Platform", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 4.0, None),
                ("Rust Native Win32 LowLevelMouseProc", "Optimized hook callback throughput under CPU stress.", "Core Platform", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 3.5, None),
            ]),

            # Marcus Vance - Today
            (marcus_emp, today_date, TaskSheetStatusEnum.SUBMITTED.value,
             "Finalized design tokens for Dark/Light glassmorphism and mobile layout reflow.",
             "Waiting on brand assets for new vector icons from client team.", david_mgr, None, [
                ("Figma Design System V2 Tokens", "Created full HSL palette, dark theme glass tokens, and responsive typography variables.", "UI/UX Design", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 3.0, None),
                ("Screenshot Viewer Modal Polish", "Designed full-screen lightbox modal with keyboard arrow navigation.", "UI/UX Design", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 2.0, None),
                ("Mobile Responsive Nav Drawer", "Wireframed collapsible sidebar navigation for smaller tablet screens.", "UI/UX Design", TaskPriorityEnum.LOW.value, TaskStatusEnum.BLOCKED.value, 0.5, "Awaiting approval on navigation hierarchy"),
            ]),

            # Aisha Patel - Today
            (aisha_emp, today_date, TaskSheetStatusEnum.SUBMITTED.value,
             "Implemented background database migration and indexing for large audit logs.",
             None, sarah_mgr, None, [
                ("SQLAlchemy Async Session Pool Tuning", "Configured max overflow and pool pre-ping connection check.", "Database & Backend", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 3.5, None),
                ("Composite Index on Activity Timestamps", "Added index to activity_logs table for fast interval queries.", "Database & Backend", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 2.0, None),
                ("Database Backup Cron Integration", "Writing automated nightly snapshot script to S3-compatible storage.", "DevOps", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.IN_PROGRESS.value, 1.0, None),
            ]),
            # Aisha Patel - Yesterday
            (aisha_emp, yesterday_date, TaskSheetStatusEnum.APPROVED.value,
             "Completed activity logs partition planning and migration test script.",
             None, sarah_mgr, "Partitioning plan looks very solid. Approved for staging rollout.", [
                ("Table Partitioning DDL Generation", "Designed monthly range partitioning schema for activity records.", "Database & Backend", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 4.0, None),
                ("Dry-run Benchmark on 1M Records", "Measured query response times before and after index optimization.", "Database & Backend", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 3.0, None),
            ]),

            # James Wilson - Today
            (james_emp, today_date, TaskSheetStatusEnum.APPROVED.value,
             "All scheduled bug tickets resolved and closed for sprint 14.",
             None, sarah_mgr, "Superb turnaround time on the critical security patch James.", [
                ("Fix Screenshot Upload Rate Limiter", "Fixed IP spoofing bypass on agent screenshot upload handler.", "Security & Auth", TaskPriorityEnum.URGENT.value, TaskStatusEnum.COMPLETED.value, 3.0, None),
                ("Refactor Employee Punctuality Star Evaluator", "Added grace period condition checker according to active rules.", "Core Platform", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 3.0, None),
                ("Documentation for API V1 Endpoints", "Generated OpenAPI swagger schemas and route test recipes.", "Documentation", TaskPriorityEnum.LOW.value, TaskStatusEnum.COMPLETED.value, 2.0, None),
            ]),
            # James Wilson - Yesterday
            (james_emp, yesterday_date, TaskSheetStatusEnum.APPROVED.value,
             "Fixed JWT bearer token verification edge case on expired refresh tokens.",
             None, sarah_mgr, "Good catch on token expiration handling.", [
                ("Bearer Auth Header Interceptor", "Handled clock skew edge cases in JWT payload expiration check.", "Security & Auth", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 4.0, None),
                ("Security Audit Trail Integration", "Logged all failed authorization attempts with client IP metadata.", "Security & Auth", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 3.5, None),
            ]),

            # Carlos Mendez - Today
            (carlos_emp, today_date, TaskSheetStatusEnum.DRAFT.value,
             "Investigating intermittent agent disconnects on Windows sleep mode.",
             "Need test laptop with Windows 10 build 19045.", None, None, [
                ("Desktop Agent Power State Listener", "Added Win32 API power broadcast notification handlers.", "Desktop Agent", TaskPriorityEnum.HIGH.value, TaskStatusEnum.IN_PROGRESS.value, 3.0, None),
                ("Heartbeat Reconnect Backoff Strategy", "Implementing exponential backoff with jitter on reconnect.", "Desktop Agent", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.IN_PROGRESS.value, 2.0, None),
            ]),
            # Carlos Mendez - Yesterday
            (carlos_emp, yesterday_date, TaskSheetStatusEnum.APPROVED.value,
             "Added multi-monitor virtual screen coordinate normalization in Rust agent.",
             None, sarah_mgr, "Multi-monitor coordinate mapping is working smoothly now.", [
                ("Virtual Screen Boundary Mapping", "Calculated DPI-aware desktop bounds across asymmetric monitors.", "Desktop Agent", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 4.0, None),
                ("Per-monitor DPI Awareness V2", "Enabled SetProcessDpiAwarenessContext on agent process launch.", "Desktop Agent", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 3.0, None),
            ]),

            # Sophie Martin - Today
            (sophie_emp, today_date, TaskSheetStatusEnum.SUBMITTED.value,
             "Writing Playwright automated regression test suite.",
             None, sarah_mgr, None, [
                ("Playwright End-to-End Test Suite", "Created automated browser scripts for login, role switcher, and rules update.", "Testing & QA", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 3.5, None),
                ("Cross-browser Consistency Checks", "Verified UI alignment across Chromium, Firefox, and WebKit engines.", "Testing & QA", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 2.0, None),
                ("Screenshot Compression Quality Test", "Verified WEBP 65% quality threshold balances fidelity and size.", "Testing & QA", TaskPriorityEnum.LOW.value, TaskStatusEnum.IN_PROGRESS.value, 1.5, None),
            ]),
            # Sophie Martin - Yesterday
            (sophie_emp, yesterday_date, TaskSheetStatusEnum.APPROVED.value,
             "Completed smoke test matrix for sprint 14 deployment.",
             None, sarah_mgr, "Smoke test suite passed with zero blockers.", [
                ("Authentication & Session Invalidation QA", "Tested forced logout and expired bearer token rejection.", "Testing & QA", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 4.0, None),
                ("Attendance Summary Report Verification", "Cross-checked automated punctuality stars against rule engine.", "Testing & QA", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 3.0, None),
            ]),

            # Ryan Gallagher - Today
            (ryan_emp, today_date, TaskSheetStatusEnum.SUBMITTED.value,
             "Conducted API stress tests and validated concurrent employee check-ins.",
             None, sarah_mgr, None, [
                ("Locust Load Test Script for Check-ins", "Simulated 200 concurrent agent heartbeats and check-in calls.", "Testing & QA", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 4.0, None),
                ("Database Lock Contention Analysis", "Analyzed row lock wait times during bulk attendance updates.", "Testing & QA", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 2.5, None),
            ]),
            # Ryan Gallagher - Yesterday
            (ryan_emp, yesterday_date, TaskSheetStatusEnum.APPROVED.value,
             "Verified desktop screenshot thumbnail generation latency.",
             None, sarah_mgr, "Latency numbers are well within SLA limits.", [
                ("Pillow WEBP Encode Benchmarking", "Compared thumbnail generation times across different downsampling filters.", "Testing & QA", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 4.0, None),
                ("Error Handling on Corrupted Uploads", "Wrote unit tests asserting HTTP 422 on truncated image payloads.", "Testing & QA", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 3.0, None),
            ]),

            # Chloe Dubois - Today
            (chloe_emp, today_date, TaskSheetStatusEnum.APPROVED.value,
             "Created vector iconography set for rules scorecard and punctuality badges.",
             None, david_mgr, "Beautiful visual assets Chloe! Ready for integration.", [
                ("SVG Icon Set for Punctuality Badges", "Designed 12 pixel-perfect SVG icons for gold, silver, and bronze tiers.", "UI/UX Design", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 4.0, None),
                ("Empty State Illustrations", "Illustrated cohesive empty state graphics for task sheets and gallery.", "UI/UX Design", TaskPriorityEnum.MEDIUM.value, TaskStatusEnum.COMPLETED.value, 3.0, None),
            ]),

            # Liam Chen - Today
            (liam_emp, today_date, TaskSheetStatusEnum.SUBMITTED.value,
             "Configured Kubernetes Helm charts and Docker multi-stage builds for backend API.",
             "Awaiting staging cluster ingress SSL certificate provisioning.", priya_mgr, None, [
                ("Docker Multi-stage Build Optimization", "Reduced backend image footprint from 850MB to 165MB.", "DevOps & Cloud", TaskPriorityEnum.HIGH.value, TaskStatusEnum.COMPLETED.value, 4.5, None),
                ("Helm Values Template for Staging", "Added resource limits, liveness and readiness probe configs.", "DevOps & Cloud", TaskPriorityEnum.HIGH.value, TaskStatusEnum.IN_PROGRESS.value, 2.5, "Awaiting SSL certificate"),
            ]),
        ]

        for emp_obj, s_date, s_status, s_notes, s_blockers, reviewer_obj, m_feedback, task_list in sheets_seed_plan:
            if not emp_obj:
                continue
            existing_sheet = (await db.execute(select(TaskSheet).where(TaskSheet.employee_id == emp_obj.id, TaskSheet.sheet_date == s_date))).scalars().first()
            if not existing_sheet:
                total_h = sum(t[5] for t in task_list)
                sh = TaskSheet(
                    id=str(uuid.uuid4()),
                    employee_id=emp_obj.id,
                    sheet_date=s_date,
                    status=s_status,
                    summary_notes=s_notes,
                    blockers_summary=s_blockers,
                    total_hours=round(total_h, 2),
                    manager_feedback=m_feedback,
                    reviewed_by_id=reviewer_obj.id if reviewer_obj else None,
                    reviewed_at=now - timedelta(hours=1) if reviewer_obj and m_feedback else None,
                    created_at=now - timedelta(hours=6),
                )
                db.add(sh)
                await db.flush()

                for t_title, t_desc, t_cat, t_prio, t_stat, t_hrs, t_block in task_list:
                    ti = TaskItem(
                        id=str(uuid.uuid4()),
                        sheet_id=sh.id,
                        title=t_title,
                        description=t_desc,
                        category=t_cat,
                        priority=t_prio,
                        status=t_stat,
                        hours_spent=t_hrs,
                        blockers=t_block,
                        created_at=now - timedelta(hours=5),
                    )
                    db.add(ti)

        await db.commit()
        print("Successfully seeded employees, attendance, heatmaps, screenshots, finance messaging, and daily task sheets!")


if __name__ == "__main__":
    asyncio.run(seed())
