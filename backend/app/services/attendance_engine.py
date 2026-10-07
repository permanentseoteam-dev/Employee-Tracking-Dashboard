from datetime import date, datetime, time, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.attendance import Attendance, AttendanceStatusEnum
from app.models.rules import SettingRule
from app.schemas.activity import ActivityBatchItem, SystemEventItem


class AttendanceEngine:
    @staticmethod
    async def get_active_rules(db: AsyncSession) -> dict:
        stmt = select(SettingRule).where(
            SettingRule.rule_type == "ATTENDANCE",
            SettingRule.is_active == True,
        )
        result = await db.execute(stmt)
        rule = result.scalars().first()
        if rule and rule.config_payload:
            return rule.config_payload
        
        # Fallback defaults
        return {
            "shift_start": settings.DEFAULT_SHIFT_START,
            "shift_end": settings.DEFAULT_SHIFT_END,
            "grace_period_minutes": settings.DEFAULT_GRACE_MINUTES,
            "minimum_active_hours_full_day": 7.0,
            "half_day_hours": 4.0,
        }

    @classmethod
    async def get_or_create_daily_attendance(
        cls, db: AsyncSession, employee_id: str, target_date: date
    ) -> Attendance:
        stmt = select(Attendance).where(
            Attendance.employee_id == employee_id,
            Attendance.work_date == target_date,
        )
        result = await db.execute(stmt)
        attendance = result.scalars().first()
        if not attendance:
            attendance = Attendance(
                employee_id=employee_id,
                work_date=target_date,
                status=AttendanceStatusEnum.OFFLINE.value,
                active_seconds=0,
                idle_seconds=0,
            )
            db.add(attendance)
            await db.flush()
        return attendance

    @classmethod
    async def process_system_events(
        cls, db: AsyncSession, employee_id: str, events: list[SystemEventItem]
    ):
        for evt in events:
            event_date = evt.timestamp.date()
            attendance = await cls.get_or_create_daily_attendance(db, employee_id, event_date)
            
            if evt.event_type == "BOOT":
                if not attendance.boot_time or evt.timestamp < attendance.boot_time:
                    attendance.boot_time = evt.timestamp
            elif evt.event_type in ("LOGIN", "UNLOCK"):
                if not attendance.login_time or evt.timestamp < attendance.login_time:
                    attendance.login_time = evt.timestamp

    @classmethod
    async def process_activity_for_attendance(
        cls,
        db: AsyncSession,
        employee_id: str,
        activity_batches: list[ActivityBatchItem],
    ):
        if not activity_batches:
            return

        rules = await cls.get_active_rules(db)
        shift_start_str = rules.get("shift_start", settings.DEFAULT_SHIFT_START)
        grace_minutes = rules.get("grace_period_minutes", settings.DEFAULT_GRACE_MINUTES)
        
        shift_hour, shift_minute, shift_sec = map(int, shift_start_str.split(":"))
        shift_time = time(shift_hour, shift_minute, shift_sec)

        for batch in activity_batches:
            batch_date = batch.start_time.date()
            attendance = await cls.get_or_create_daily_attendance(db, employee_id, batch_date)

            # Check if this batch represents meaningful activity (keys or mouse clicks/moves > 0)
            has_meaningful_activity = (
                batch.key_press_count > 0 or
                batch.mouse_click_count > 0 or
                batch.mouse_move_count > 0 or
                batch.active_seconds > 0
            )

            if has_meaningful_activity:
                # Update first activity
                if not attendance.first_activity or batch.start_time < attendance.first_activity:
                    attendance.first_activity = batch.start_time

                # Update last activity
                if not attendance.last_activity or batch.end_time > attendance.last_activity:
                    attendance.last_activity = batch.end_time

            # Accumulate active and idle seconds
            attendance.active_seconds += batch.active_seconds
            attendance.idle_seconds += batch.idle_seconds

            # Calculate / evaluate status if first_activity exists
            if attendance.first_activity:
                # Convert first activity to local time
                first_act_time = attendance.first_activity.time()
                
                # Grace deadline calculation
                grace_delta = timedelta(minutes=grace_minutes)
                shift_dt = datetime.combine(batch_date, shift_time)
                grace_deadline = (shift_dt + grace_delta).time()

                if first_act_time <= grace_deadline:
                    attendance.status = AttendanceStatusEnum.PRESENT.value
                else:
                    attendance.status = AttendanceStatusEnum.LATE.value

                attendance.rule_eval_context = {
                    "shift_start": shift_start_str,
                    "grace_period_minutes": grace_minutes,
                    "evaluated_at": datetime.now().isoformat(),
                    "first_activity": attendance.first_activity.isoformat(),
                }


attendance_engine = AttendanceEngine()
