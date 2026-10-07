from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_scoped_employee_ids, require_role
from app.database import get_db
from app.models.employee import Employee, RoleEnum
from app.models.rules import EmployeeStar, SettingRule
from app.schemas.rules import (
    EmployeeStarOut,
    SettingRuleCreate,
    SettingRuleOut,
    SettingRuleUpdate,
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
    _user: Employee = Depends(require_role([RoleEnum.ADMIN, RoleEnum.MANAGER])),
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
    _user: Employee = Depends(require_role([RoleEnum.ADMIN, RoleEnum.MANAGER])),
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
    _user: Employee = Depends(require_role([RoleEnum.ADMIN, RoleEnum.MANAGER])),
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
    _admin: Employee = Depends(require_role([RoleEnum.ADMIN, RoleEnum.MANAGER])),
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
