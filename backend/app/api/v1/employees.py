from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models.employee import Employee, RoleEnum
from app.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate
from app.services.audit_service import audit_service
from app.services.auth import hash_password

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("", response_model=list[EmployeeOut])
async def list_employees(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    stmt = select(Employee)
    if current_user.role == RoleEnum.MANAGER.value:
        stmt = stmt.where(
            (Employee.manager_id == current_user.id) | (Employee.id == current_user.id)
        )
    elif current_user.role == RoleEnum.EMPLOYEE.value:
        stmt = stmt.where(Employee.id == current_user.id)

    stmt = stmt.order_by(Employee.name.asc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    admin: Employee = Depends(require_role([RoleEnum.ADMIN])),
):
    # Check duplicate email or code
    existing_stmt = select(Employee).where(
        (Employee.email == payload.email) | (Employee.employee_code == payload.employee_code)
    )
    existing = (await db.execute(existing_stmt)).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee with this email or employee code already exists",
        )

    employee = Employee(
        employee_code=payload.employee_code,
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        status=payload.status,
        department_id=payload.department_id,
        manager_id=payload.manager_id,
    )
    db.add(employee)
    await db.flush()

    await audit_service.log_action(
        db=db,
        actor_id=admin.id,
        actor_email=admin.email,
        action="CREATE_EMPLOYEE",
        entity_type="EMPLOYEE",
        entity_id=employee.id,
        change_diff={"email": employee.email, "role": employee.role, "code": employee.employee_code},
    )

    return employee


@router.get("/{emp_id}", response_model=EmployeeOut)
async def get_employee(
    emp_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    stmt = select(Employee).where(Employee.id == emp_id)
    emp = (await db.execute(stmt)).scalars().first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Scope check
    if current_user.role == RoleEnum.MANAGER.value:
        if emp.manager_id != current_user.id and emp.id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden: Employee is outside your scope")
    elif current_user.role == RoleEnum.EMPLOYEE.value:
        if emp.id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot view other employee profile")

    return emp


@router.put("/{emp_id}", response_model=EmployeeOut)
async def update_employee(
    emp_id: str,
    payload: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Employee = Depends(require_role([RoleEnum.ADMIN])),
):
    stmt = select(Employee).where(Employee.id == emp_id)
    emp = (await db.execute(stmt)).scalars().first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if payload.employee_code is not None:
        emp.employee_code = payload.employee_code
    if payload.name is not None:
        emp.name = payload.name
    if payload.email is not None:
        emp.email = payload.email
    if payload.role is not None:
        emp.role = payload.role
    if payload.status is not None:
        emp.status = payload.status
    if payload.department_id is not None:
        emp.department_id = payload.department_id
    if payload.manager_id is not None:
        emp.manager_id = payload.manager_id
    if payload.password is not None:
        emp.password_hash = hash_password(payload.password)

    await audit_service.log_action(
        db=db,
        actor_id=admin.id,
        actor_email=admin.email,
        action="UPDATE_EMPLOYEE",
        entity_type="EMPLOYEE",
        entity_id=emp.id,
        change_diff=payload.model_dump(exclude_unset=True, exclude={"password"}),
    )

    return emp
