import asyncio
from app.database import Base, async_session_factory, engine
from app.models.department import Department
from app.models.employee import Employee, RoleEnum, StatusEnum
from app.models.rules import SettingRule
from app.services.auth import hash_password


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        # Check if already seeded
        from sqlalchemy import select
        res = await db.execute(select(Employee).where(Employee.email == "admin@tracking.local"))
        if res.scalars().first():
            print("Database already seeded.")
            return

        # 1. Departments
        eng_dept = Department(name="Engineering", code="ENG")
        sales_dept = Department(name="Sales & Marketing", code="SALES")
        hr_dept = Department(name="Human Resources", code="HR")
        db.add_all([eng_dept, sales_dept, hr_dept])
        await db.flush()

        # 2. Admin User
        admin = Employee(
            employee_code="ADM001",
            name="System Administrator",
            email="admin@tracking.local",
            password_hash=hash_password("admin123"),
            role=RoleEnum.ADMIN.value,
            status=StatusEnum.ACTIVE.value,
            department_id=eng_dept.id,
        )
        db.add(admin)
        await db.flush()

        # 3. Manager
        manager = Employee(
            employee_code="MGR001",
            name="Sarah Connor (Tech Lead)",
            email="manager@tracking.local",
            password_hash=hash_password("manager123"),
            role=RoleEnum.MANAGER.value,
            status=StatusEnum.ACTIVE.value,
            department_id=eng_dept.id,
        )
        db.add(manager)
        await db.flush()

        # 4. Employees
        emp1 = Employee(
            employee_code="EMP001",
            name="Alex Rivera",
            email="alex@tracking.local",
            password_hash=hash_password("alex123"),
            role=RoleEnum.EMPLOYEE.value,
            status=StatusEnum.ACTIVE.value,
            department_id=eng_dept.id,
            manager_id=manager.id,
        )
        emp2 = Employee(
            employee_code="EMP002",
            name="Elena Rostova",
            email="elena@tracking.local",
            password_hash=hash_password("elena123"),
            role=RoleEnum.EMPLOYEE.value,
            status=StatusEnum.ACTIVE.value,
            department_id=eng_dept.id,
            manager_id=manager.id,
        )
        db.add_all([emp1, emp2])

        # 5. Default Rules
        attendance_rule = SettingRule(
            rule_type="ATTENDANCE",
            name="Standard Working Hours",
            is_active=True,
            config_payload={
                "shift_start": "09:00:00",
                "shift_end": "18:00:00",
                "grace_period_minutes": 10,
                "minimum_active_hours_full_day": 7.0,
            },
        )
        star_rule = SettingRule(
            rule_type="STAR",
            name="Performance Star Rules",
            is_active=True,
            config_payload={
                "punctuality_star_enabled": True,
                "min_active_seconds_for_star": 21600,
            },
        )
        monitoring_rule = SettingRule(
            rule_type="MONITORING",
            name="Default Screenshot Schedule",
            is_active=True,
            config_payload={
                "interval_minutes": 10,
                "start_time": "09:00:00",
                "end_time": "18:00:00",
                "quality": 65,
                "max_width": 1280,
                "max_height": 720,
            },
        )
        retention_rule = SettingRule(
            rule_type="RETENTION",
            name="Data Retention Policy",
            is_active=True,
            config_payload={
                "screenshot_retention_days": 30,
                "activity_retention_days": 90,
                "attendance_retention_days": 730,
            },
        )
        db.add_all([attendance_rule, star_rule, monitoring_rule, retention_rule])

        await db.commit()
        print("Successfully seeded initial departments, users, and rules!")


if __name__ == "__main__":
    asyncio.run(seed())
