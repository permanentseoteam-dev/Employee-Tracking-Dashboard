from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_scoped_employee_ids
from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatusEnum
from app.models.employee import Employee
from app.models.rules import EmployeeStar
from app.schemas.rules import DashboardMetricsOut

router = APIRouter(prefix="/dashboard", tags=["Dashboard Metrics"])


@router.get("/metrics", response_model=DashboardMetricsOut)
async def get_dashboard_metrics(
    target_date: date | None = None,
    db: AsyncSession = Depends(get_db),
    scoped_ids: list[str] | None = Depends(get_scoped_employee_ids),
):
    actual_date = target_date or date.today()

    # Total employees in scope
    emp_stmt = select(func.count(Employee.id)).where(Employee.status == "ACTIVE")
    if scoped_ids is not None:
        emp_stmt = emp_stmt.where(Employee.id.in_(scoped_ids))
    total_emp = (await db.execute(emp_stmt)).scalar() or 0

    # Attendance counts for today
    att_stmt = select(Attendance.status, func.count(Attendance.id)).where(
        Attendance.work_date == actual_date
    )
    if scoped_ids is not None:
        att_stmt = att_stmt.where(Attendance.employee_id.in_(scoped_ids))
    att_stmt = att_stmt.group_by(Attendance.status)
    att_counts = dict((await db.execute(att_stmt)).all())

    present_today = att_counts.get(AttendanceStatusEnum.PRESENT.value, 0)
    late_today = att_counts.get(AttendanceStatusEnum.LATE.value, 0)
    absent_today = att_counts.get(AttendanceStatusEnum.ABSENT.value, 0)
    offline_today = att_counts.get(AttendanceStatusEnum.OFFLINE.value, 0)

    # Compute attendance percentage
    active_attendance = present_today + late_today
    avg_att_pct = (active_attendance / total_emp * 100.0) if total_emp > 0 else 0.0

    # Total stars awarded
    star_stmt = select(func.coalesce(func.sum(EmployeeStar.star_count), 0))
    if scoped_ids is not None:
        star_stmt = star_stmt.where(EmployeeStar.employee_id.in_(scoped_ids))
    total_stars = (await db.execute(star_stmt)).scalar() or 0

    return DashboardMetricsOut(
        total_employees=total_emp,
        present_today=present_today,
        late_today=late_today,
        absent_today=absent_today,
        offline_today=offline_today,
        average_attendance_pct=round(avg_att_pct, 1),
        total_stars_awarded=int(total_stars),
    )
