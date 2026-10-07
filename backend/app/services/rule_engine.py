import uuid
from datetime import date, datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.attendance import Attendance, AttendanceStatusEnum
from app.models.rules import EmployeeStar, SettingRule


class RuleEngine:
    @staticmethod
    async def evaluate_daily_stars(
        db: AsyncSession, employee_id: str, work_date: date
    ) -> list[EmployeeStar]:
        """Evaluates star awarding criteria for an employee on a given day."""
        # Check active star rules
        stmt = select(SettingRule).where(
            SettingRule.rule_type == "STAR",
            SettingRule.is_active == True,
        )
        res = await db.execute(stmt)
        star_rule = res.scalars().first()

        # Fetch attendance record
        att_stmt = select(Attendance).where(
            Attendance.employee_id == employee_id,
            Attendance.work_date == work_date,
        )
        att_res = await db.execute(att_stmt)
        attendance = att_res.scalars().first()
        if not attendance:
            return []

        awarded_stars: list[EmployeeStar] = []
        now_dt = datetime.now(timezone.utc)

        # 1. Punctuality Star
        if attendance.status == AttendanceStatusEnum.PRESENT.value:
            existing_stmt = select(EmployeeStar).where(
                EmployeeStar.employee_id == employee_id,
                EmployeeStar.award_date == work_date,
                EmployeeStar.reason == "On-Time Arrival (Punctuality)",
            )
            existing = (await db.execute(existing_stmt)).scalars().first()
            if not existing:
                star = EmployeeStar(
                    id=str(uuid.uuid4()),
                    employee_id=employee_id,
                    award_date=work_date,
                    star_count=1,
                    reason="On-Time Arrival (Punctuality)",
                    criteria_snapshot={
                        "status": attendance.status,
                        "first_activity": attendance.first_activity.isoformat() if attendance.first_activity else None,
                    },
                    awarded_at=now_dt,
                )
                db.add(star)
                awarded_stars.append(star)

        # 2. Daily Active Time Star (e.g., active_seconds >= 6 hours = 21600 seconds)
        active_threshold_sec = 21600
        if star_rule and star_rule.config_payload:
            active_threshold_sec = star_rule.config_payload.get("min_active_seconds_for_star", 21600)

        if attendance.active_seconds >= active_threshold_sec:
            existing_stmt = select(EmployeeStar).where(
                EmployeeStar.employee_id == employee_id,
                EmployeeStar.award_date == work_date,
                EmployeeStar.reason == "High Daily Engagement & Activity",
            )
            existing = (await db.execute(existing_stmt)).scalars().first()
            if not existing:
                star = EmployeeStar(
                    id=str(uuid.uuid4()),
                    employee_id=employee_id,
                    award_date=work_date,
                    star_count=1,
                    reason="High Daily Engagement & Activity",
                    criteria_snapshot={
                        "active_seconds": attendance.active_seconds,
                        "threshold": active_threshold_sec,
                    },
                    awarded_at=now_dt,
                )
                db.add(star)
                awarded_stars.append(star)

        if awarded_stars:
            await db.flush()

        return awarded_stars


rule_engine = RuleEngine()
