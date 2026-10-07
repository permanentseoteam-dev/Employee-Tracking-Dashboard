from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_scoped_employee_ids
from app.database import get_db
from app.models.attendance import Attendance
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.attendance import AttendanceOut, AttendanceSummary

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("", response_model=list[AttendanceOut])
async def list_attendance(
    employee_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    scoped_ids: list[str] | None = Depends(get_scoped_employee_ids),
):
    stmt = select(Attendance)

    if scoped_ids is not None:
        if employee_id:
            if employee_id not in scoped_ids:
                return []
            stmt = stmt.where(Attendance.employee_id == employee_id)
        else:
            stmt = stmt.where(Attendance.employee_id.in_(scoped_ids))
    elif employee_id:
        stmt = stmt.where(Attendance.employee_id == employee_id)

    if date_from:
        stmt = stmt.where(Attendance.work_date >= date_from)
    if date_to:
        stmt = stmt.where(Attendance.work_date <= date_to)

    stmt = stmt.order_by(Attendance.work_date.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/summary", response_model=list[AttendanceSummary])
async def get_attendance_summary(
    target_date: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    scoped_ids: list[str] | None = Depends(get_scoped_employee_ids),
):
    actual_date = target_date or date.today()
    stmt = (
        select(
            Attendance,
            Employee.name.label("emp_name"),
            Employee.employee_code.label("emp_code"),
            Department.name.label("dept_name"),
        )
        .join(Employee, Attendance.employee_id == Employee.id)
        .outerjoin(Department, Employee.department_id == Department.id)
        .where(Attendance.work_date == actual_date)
    )

    if scoped_ids is not None:
        stmt = stmt.where(Attendance.employee_id.in_(scoped_ids))

    res = await db.execute(stmt)
    rows = res.all()

    summaries = []
    for att, emp_name, emp_code, dept_name in rows:
        summaries.append(
            AttendanceSummary(
                employee_id=att.employee_id,
                employee_name=emp_name,
                employee_code=emp_code,
                department_name=dept_name,
                work_date=att.work_date,
                first_activity=att.first_activity,
                last_activity=att.last_activity,
                active_hours=round(att.active_seconds / 3600.0, 2),
                idle_hours=round(att.idle_seconds / 3600.0, 2),
                status=att.status,
            )
        )
    return summaries
