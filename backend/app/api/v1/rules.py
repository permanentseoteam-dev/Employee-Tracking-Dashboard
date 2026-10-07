from datetime import date, datetime, time, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.deps import get_current_user, get_scoped_employee_ids, require_role
from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatusEnum
from app.models.employee import Employee, RoleEnum
from app.models.rules import EmployeeStar, SettingRule
from app.schemas.rules import (
    EmployeeStarOut,
    PerformanceScorecardOut,
    PolicyViolationItem,
    SettingRuleCreate,
    SettingRuleOut,
    SettingRuleUpdate,
    StarLedgerItem,
)
from app.services.rule_engine import rule_engine

router = APIRouter(prefix="/rules", tags=["Rules & Stars"])


@router.get("", response_model=list[SettingRuleOut])
async def list_rules(
    rule_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: Employee = Depends(get_current_user),
):
    stmt = select(SettingRule)
    if rule_type:
        stmt = stmt.where(SettingRule.rule_type == rule_type)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("", response_model=SettingRuleOut, status_code=status.HTTP_201_CREATED)
async def create_rule(
    payload: SettingRuleCreate,
    db: AsyncSession = Depends(get_db),
    _user: Employee = Depends(require_role([RoleEnum.ADMIN])),
):
    rule = SettingRule(
        rule_type=payload.rule_type,
        name=payload.name,
        description=payload.description or "",
        is_active=payload.is_active,
        config_payload=payload.config_payload or {},
    )
    db.add(rule)
    await db.flush()
    return rule


@router.put("/{rule_id}", response_model=SettingRuleOut)
async def update_rule(
    rule_id: str,
    payload: SettingRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _user: Employee = Depends(require_role([RoleEnum.ADMIN])),
):
    stmt = select(SettingRule).where(SettingRule.id == rule_id)
    rule = (await db.execute(stmt)).scalars().first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if payload.name is not None:
        rule.name = payload.name
    if payload.description is not None:
        rule.description = payload.description
    if payload.is_active is not None:
        rule.is_active = payload.is_active
    if payload.config_payload is not None:
        rule.config_payload = payload.config_payload

    return rule


@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    _user: Employee = Depends(require_role([RoleEnum.ADMIN])),
):
    stmt = select(SettingRule).where(SettingRule.id == rule_id)
    rule = (await db.execute(stmt)).scalars().first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await db.delete(rule)
    return {"message": "Policy rule successfully deleted", "id": rule_id}


@router.post("/evaluate-stars/{employee_id}", response_model=list[EmployeeStarOut])
async def evaluate_stars(
    employee_id: str,
    target_date: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: Employee = Depends(require_role([RoleEnum.ADMIN])),
):
    actual_date = target_date or date.today()
    stars = await rule_engine.evaluate_daily_stars(db, employee_id, actual_date)
    return stars


@router.get("/stars", response_model=list[EmployeeStarOut])
async def list_stars(
    employee_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    scoped_ids: list[str] | None = Depends(get_scoped_employee_ids),
):
    stmt = select(EmployeeStar)
    if scoped_ids is not None:
        if employee_id:
            if employee_id not in scoped_ids:
                return []
            stmt = stmt.where(EmployeeStar.employee_id == employee_id)
        else:
            stmt = stmt.where(EmployeeStar.employee_id.in_(scoped_ids))
    elif employee_id:
        stmt = stmt.where(EmployeeStar.employee_id == employee_id)

    stmt = stmt.order_by(EmployeeStar.awarded_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/performance", response_model=PerformanceScorecardOut)
async def get_performance_scorecard(
    employee_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Returns detailed performance metrics, stars earned, and policy violation infractions.
    Scoped: Employees only see themselves; Managers see themselves or subordinates; Admins see any employee."""
    target_id = employee_id

    if current_user.role in (RoleEnum.EMPLOYEE.value, RoleEnum.MANAGER.value):
        target_id = current_user.id
    else:
        if not target_id:
            target_id = current_user.id

    emp_stmt = select(Employee).options(selectinload(Employee.department)).where(Employee.id == target_id)
    emp = (await db.execute(emp_stmt)).scalars().first()
    if not emp:
        # Fallback if admin has no profile record
        emp = current_user

    dept_name = emp.department.name if emp.department else "General"

    att_stmt = select(Attendance).where(Attendance.employee_id == target_id).order_by(Attendance.work_date.desc())
    attendances = (await db.execute(att_stmt)).scalars().all()

    total_days = len(attendances)
    on_time_days = sum(1 for a in attendances if a.status == AttendanceStatusEnum.PRESENT.value)
    late_days = sum(1 for a in attendances if a.status == AttendanceStatusEnum.LATE.value)
    offline_days = sum(1 for a in attendances if a.status == AttendanceStatusEnum.OFFLINE.value)
    total_active_sec = sum(a.active_seconds for a in attendances)
    total_active_hours = round(total_active_sec / 3600.0, 1)
    avg_active_hours = round((total_active_sec / total_days) / 3600.0, 1) if total_days > 0 else 0.0
    punctuality_rate = round((on_time_days / total_days * 100.0), 1) if total_days > 0 else 100.0

    stars_stmt = select(EmployeeStar).where(EmployeeStar.employee_id == target_id).order_by(EmployeeStar.awarded_at.desc())
    stars_rows = (await db.execute(stars_stmt)).scalars().all()
    total_stars = sum(s.star_count for s in stars_rows)

    stars_ledger = [
        StarLedgerItem(
            id=s.id,
            date=s.award_date,
            reason=s.reason,
            star_count=s.star_count,
            rule_type="STAR_AWARD",
            criteria=s.criteria_snapshot,
            awarded_at=s.awarded_at,
        )
        for s in stars_rows
    ]

    violations_ledger: list[PolicyViolationItem] = []
    for a in attendances:
        if a.status == AttendanceStatusEnum.LATE.value:
            first_time_str = a.first_activity.strftime("%I:%M %p") if a.first_activity else "09:20+ AM"
            violations_ledger.append(
                PolicyViolationItem(
                    id=f"viol-{a.id}-late",
                    date=a.work_date,
                    policy_name="Shift Punctuality Policy (15m Grace Period)",
                    violation_type="LATE_ARRIVAL",
                    severity="WARNING",
                    details=f"First activity recorded at {first_time_str}. Exceeded shift start (09:00 AM) and grace deadline.",
                    star_impact="Daily Punctuality Star Forfeited (-1 Star Opportunity)",
                    recorded_at=a.first_activity or datetime.combine(a.work_date, time(9, 30), tzinfo=timezone.utc),
                )
            )
        elif a.status == AttendanceStatusEnum.ABSENT.value or (a.active_seconds > 0 and a.active_seconds < 14400):
            hours = round(a.active_seconds / 3600.0, 1)
            violations_ledger.append(
                PolicyViolationItem(
                    id=f"viol-{a.id}-hours",
                    date=a.work_date,
                    policy_name="Minimum Active Working Hours Policy",
                    violation_type="HOURS_SHORTFALL",
                    severity="INFRACTION",
                    details=f"Only {hours} active hours logged. Failed to meet minimum threshold for full-day shift.",
                    star_impact="Daily Engagement Star Ineligible",
                    recorded_at=a.last_activity or datetime.combine(a.work_date, time(18, 0), tzinfo=timezone.utc),
                )
            )
        elif a.status == AttendanceStatusEnum.OFFLINE.value:
            violations_ledger.append(
                PolicyViolationItem(
                    id=f"viol-{a.id}-offline",
                    date=a.work_date,
                    policy_name="Attendance & Workstation Check-In Policy",
                    violation_type="UNSCHEDULED_OFFLINE",
                    severity="PENALTY",
                    details="Zero device activity recorded during scheduled business hours.",
                    star_impact="Absence Infraction Recorded",
                    recorded_at=datetime.combine(a.work_date, time(18, 0), tzinfo=timezone.utc),
                )
            )
    stars_ledger.sort(key=lambda s: s.date, reverse=True)
    violations_ledger.sort(key=lambda v: v.date, reverse=True)

    return PerformanceScorecardOut(
        employee_id=emp.id,
        employee_name=emp.name,
        employee_code=emp.employee_code,
        role=emp.role,
        department=dept_name,
        total_stars=total_stars,
        total_days_logged=total_days,
        on_time_days=on_time_days,
        late_days=late_days,
        offline_days=offline_days,
        punctuality_rate_pct=punctuality_rate,
        total_active_hours=total_active_hours,
        avg_daily_active_hours=avg_active_hours,
        total_violations_count=len(violations_ledger),
        stars_ledger=stars_ledger,
        violations_ledger=violations_ledger,
    )
