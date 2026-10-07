from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import require_role
from app.database import get_db
from app.models.department import Department
from app.models.employee import Employee, RoleEnum
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate
from app.services.audit_service import audit_service

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.get("", response_model=list[DepartmentOut])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    _user: Employee = Depends(require_role([RoleEnum.ADMIN, RoleEnum.MANAGER])),
):
    stmt = select(Department).order_by(Department.name.asc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    admin: Employee = Depends(require_role([RoleEnum.ADMIN])),
):
    dept = Department(name=payload.name, code=payload.code)
    db.add(dept)
    await db.flush()

    await audit_service.log_action(
        db=db,
        actor_id=admin.id,
        actor_email=admin.email,
        action="CREATE_DEPARTMENT",
        entity_type="DEPARTMENT",
        entity_id=dept.id,
        change_diff={"name": dept.name, "code": dept.code},
    )

    return dept


@router.put("/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: str,
    payload: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Employee = Depends(require_role([RoleEnum.ADMIN])),
):
    stmt = select(Department).where(Department.id == dept_id)
    dept = (await db.execute(stmt)).scalars().first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    if payload.name is not None:
        dept.name = payload.name
    if payload.code is not None:
        dept.code = payload.code

    await audit_service.log_action(
        db=db,
        actor_id=admin.id,
        actor_email=admin.email,
        action="UPDATE_DEPARTMENT",
        entity_type="DEPARTMENT",
        entity_id=dept.id,
        change_diff=payload.model_dump(exclude_unset=True),
    )

    return dept
