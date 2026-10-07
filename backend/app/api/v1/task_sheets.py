from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models.department import Department
from app.models.employee import Employee, RoleEnum
from app.models.task_sheet import (
    TaskItem,
    TaskPriorityEnum,
    TaskSheet,
    TaskSheetStatusEnum,
    TaskStatusEnum,
)
from app.schemas.task_sheet import (
    TaskItemCreate,
    TaskItemOut,
    TaskItemUpdate,
    TaskSheetCreate,
    TaskSheetOut,
    TaskSheetReview,
    TaskSheetStats,
    TaskSheetUpdate,
)

router = APIRouter(prefix="/sheets", tags=["Daily Task Sheets"])


def _populate_sheet_out(sheet: TaskSheet) -> TaskSheetOut:
    total_tasks = len(sheet.tasks) if sheet.tasks else 0
    completed_tasks = sum(1 for t in sheet.tasks if t.status == TaskStatusEnum.COMPLETED.value) if sheet.tasks else 0
    progress_percent = int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0
    
    # Recalculate total hours from tasks if present
    calculated_hours = sum(t.hours_spent for t in sheet.tasks) if sheet.tasks else (sheet.total_hours or 0.0)

    emp_name = sheet.employee.name if sheet.employee else None
    emp_code = sheet.employee.employee_code if sheet.employee else None
    dept_name = sheet.employee.department.name if sheet.employee and sheet.employee.department else "General"
    reviewer_name = sheet.reviewer.name if sheet.reviewer else None

    tasks_out = [
        TaskItemOut(
            id=t.id,
            sheet_id=t.sheet_id,
            title=t.title,
            description=t.description,
            category=t.category,
            priority=t.priority,
            status=t.status,
            hours_spent=t.hours_spent,
            blockers=t.blockers,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in (sheet.tasks or [])
    ]

    return TaskSheetOut(
        id=sheet.id,
        employee_id=sheet.employee_id,
        sheet_date=sheet.sheet_date,
        status=sheet.status,
        summary_notes=sheet.summary_notes,
        blockers_summary=sheet.blockers_summary,
        total_hours=round(calculated_hours, 2),
        manager_feedback=sheet.manager_feedback,
        reviewed_by_id=sheet.reviewed_by_id,
        reviewed_by_name=reviewer_name,
        reviewed_at=sheet.reviewed_at,
        created_at=sheet.created_at,
        updated_at=sheet.updated_at,
        employee_name=emp_name,
        employee_code=emp_code,
        department_name=dept_name,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        progress_percent=progress_percent,
        tasks=tasks_out,
    )


@router.get("", response_model=list[TaskSheetOut])
async def list_task_sheets(
    date_param: str | None = Query(None, alias="date"),
    start_date: str | None = None,
    end_date: str | None = None,
    employee_id: str | None = None,
    department_id: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    stmt = select(TaskSheet).options(
        selectinload(TaskSheet.employee).selectinload(Employee.department),
        selectinload(TaskSheet.reviewer),
        selectinload(TaskSheet.tasks),
    ).join(TaskSheet.employee)

    # Role-based scoping
    if current_user.role == RoleEnum.EMPLOYEE.value:
        stmt = stmt.where(TaskSheet.employee_id == current_user.id)
    elif current_user.role == RoleEnum.MANAGER.value:
        if employee_id:
            # Check if requested employee is subordinate, in same department, or self
            sub_check = await db.execute(
                select(Employee).where(
                    Employee.id == employee_id,
                    or_(
                        Employee.manager_id == current_user.id,
                        Employee.department_id == current_user.department_id,
                        Employee.id == current_user.id,
                    ),
                )
            )
            if not sub_check.scalars().first():
                raise HTTPException(status_code=403, detail="Not authorized to view this employee's sheets")
            stmt = stmt.where(TaskSheet.employee_id == employee_id)
        else:
            stmt = stmt.where(
                or_(
                    Employee.manager_id == current_user.id,
                    Employee.department_id == current_user.department_id,
                    Employee.id == current_user.id,
                )
            )
    elif current_user.role == RoleEnum.ADMIN.value:
        if employee_id:
            stmt = stmt.where(TaskSheet.employee_id == employee_id)

    # Date filter
    if date_param:
        if date_param.lower() == "today":
            filter_d = date.today()
        else:
            try:
                filter_d = date.fromisoformat(date_param)
            except ValueError:
                filter_d = date.today()
        stmt = stmt.where(TaskSheet.sheet_date == filter_d)
    
    if start_date:
        try:
            sd = date.fromisoformat(start_date)
            stmt = stmt.where(TaskSheet.sheet_date >= sd)
        except ValueError:
            pass
            
    if end_date:
        try:
            ed = date.fromisoformat(end_date)
            stmt = stmt.where(TaskSheet.sheet_date <= ed)
        except ValueError:
            pass

    # Department filter
    if department_id:
        stmt = stmt.where(Employee.department_id == department_id)

    # Status filter
    if status_filter and status_filter.upper() != "ALL":
        stmt = stmt.where(TaskSheet.status == status_filter.upper())

    # Search filter (by employee name, code, or summary notes)
    if search:
        s_term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Employee.name.ilike(s_term),
                Employee.employee_code.ilike(s_term),
                TaskSheet.summary_notes.ilike(s_term),
            )
        )

    stmt = stmt.order_by(TaskSheet.sheet_date.desc(), TaskSheet.created_at.desc())
    res = await db.execute(stmt)
    sheets = res.scalars().all()

    return [_populate_sheet_out(s) for s in sheets]


@router.get("/stats/summary", response_model=TaskSheetStats)
async def get_task_sheet_stats(
    date_param: str | None = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    target_date = date.today()
    if date_param and date_param.lower() != "today":
        try:
            target_date = date.fromisoformat(date_param)
        except ValueError:
            target_date = date.today()

    stmt = select(TaskSheet).options(
        selectinload(TaskSheet.tasks),
        selectinload(TaskSheet.employee),
    ).join(TaskSheet.employee).where(TaskSheet.sheet_date == target_date)

    if current_user.role == RoleEnum.EMPLOYEE.value:
        stmt = stmt.where(TaskSheet.employee_id == current_user.id)
    elif current_user.role == RoleEnum.MANAGER.value:
        stmt = stmt.where(
            or_(Employee.manager_id == current_user.id, Employee.id == current_user.id)
        )

    res = await db.execute(stmt)
    sheets = res.scalars().all()

    total_sheets = len(sheets)
    submitted = sum(1 for s in sheets if s.status in [TaskSheetStatusEnum.SUBMITTED.value, TaskSheetStatusEnum.REVIEWED.value, TaskSheetStatusEnum.APPROVED.value])
    approved = sum(1 for s in sheets if s.status == TaskSheetStatusEnum.APPROVED.value)
    pending_reviews = sum(1 for s in sheets if s.status == TaskSheetStatusEnum.SUBMITTED.value)
    
    total_tasks = 0
    completed_tasks = 0
    total_hours = 0.0

    for s in sheets:
        if s.tasks:
            total_tasks += len(s.tasks)
            completed_tasks += sum(1 for t in s.tasks if t.status == TaskStatusEnum.COMPLETED.value)
            total_hours += sum(t.hours_spent for t in s.tasks)
        else:
            total_hours += s.total_hours or 0.0

    return TaskSheetStats(
        total_sheets=total_sheets,
        submitted_sheets=submitted,
        approved_sheets=approved,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        total_hours=round(total_hours, 2),
        pending_reviews=pending_reviews,
    )


@router.get("/today", response_model=TaskSheetOut)
async def get_or_create_today_sheet(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    today = date.today()
    stmt = (
        select(TaskSheet)
        .options(
            selectinload(TaskSheet.employee).selectinload(Employee.department),
            selectinload(TaskSheet.reviewer),
            selectinload(TaskSheet.tasks),
        )
        .where(TaskSheet.employee_id == current_user.id, TaskSheet.sheet_date == today)
    )
    res = await db.execute(stmt)
    sheet = res.scalars().first()

    if not sheet:
        sheet = TaskSheet(
            employee_id=current_user.id,
            sheet_date=today,
            status=TaskSheetStatusEnum.DRAFT.value,
            summary_notes="",
            total_hours=0.0,
        )
        db.add(sheet)
        await db.commit()
        await db.refresh(sheet, ["employee", "reviewer", "tasks"])

    return _populate_sheet_out(sheet)


@router.get("/{sheet_id}", response_model=TaskSheetOut)
async def get_task_sheet_by_id(
    sheet_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    stmt = (
        select(TaskSheet)
        .options(
            selectinload(TaskSheet.employee).selectinload(Employee.department),
            selectinload(TaskSheet.reviewer),
            selectinload(TaskSheet.tasks),
        )
        .where(TaskSheet.id == sheet_id)
    )
    res = await db.execute(stmt)
    sheet = res.scalars().first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Task sheet not found")

    # Auth check
    if current_user.role == RoleEnum.EMPLOYEE.value and sheet.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return _populate_sheet_out(sheet)


@router.post("", response_model=TaskSheetOut, status_code=status.HTTP_201_CREATED)
async def create_task_sheet(
    payload: TaskSheetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    target_emp_id = current_user.id
    if payload.employee_id and current_user.role in [RoleEnum.ADMIN.value, RoleEnum.MANAGER.value]:
        target_emp_id = payload.employee_id

    # Check if sheet for this date already exists
    stmt = select(TaskSheet).where(
        TaskSheet.employee_id == target_emp_id,
        TaskSheet.sheet_date == payload.sheet_date,
    )
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        return await get_task_sheet_by_id(existing.id, db, current_user)

    sheet = TaskSheet(
        employee_id=target_emp_id,
        sheet_date=payload.sheet_date,
        status=TaskSheetStatusEnum.DRAFT.value,
        summary_notes=payload.summary_notes,
        blockers_summary=payload.blockers_summary,
        total_hours=0.0,
    )
    db.add(sheet)
    await db.flush()

    if payload.tasks:
        for t in payload.tasks:
            task_item = TaskItem(
                sheet_id=sheet.id,
                title=t.title,
                description=t.description,
                category=t.category,
                priority=t.priority,
                status=t.status,
                hours_spent=t.hours_spent,
                blockers=t.blockers,
            )
            db.add(task_item)
            sheet.total_hours += t.hours_spent

    await db.commit()
    return await get_task_sheet_by_id(sheet.id, db, current_user)


@router.put("/{sheet_id}", response_model=TaskSheetOut)
async def update_task_sheet(
    sheet_id: str,
    payload: TaskSheetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    stmt = (
        select(TaskSheet)
        .options(
            selectinload(TaskSheet.employee).selectinload(Employee.department),
            selectinload(TaskSheet.reviewer),
            selectinload(TaskSheet.tasks),
        )
        .where(TaskSheet.id == sheet_id)
    )
    sheet = (await db.execute(stmt)).scalars().first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Task sheet not found")

    if current_user.role == RoleEnum.EMPLOYEE.value and sheet.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if payload.summary_notes is not None:
        sheet.summary_notes = payload.summary_notes
    if payload.blockers_summary is not None:
        sheet.blockers_summary = payload.blockers_summary
    if payload.status is not None:
        sheet.status = payload.status.upper()

    await db.commit()
    return _populate_sheet_out(sheet)


@router.post("/{sheet_id}/tasks", response_model=TaskItemOut, status_code=status.HTTP_201_CREATED)
async def add_task_to_sheet(
    sheet_id: str,
    payload: TaskItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    sheet = (await db.execute(select(TaskSheet).where(TaskSheet.id == sheet_id))).scalars().first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Task sheet not found")

    if current_user.role == RoleEnum.EMPLOYEE.value and sheet.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    task = TaskItem(
        sheet_id=sheet_id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        priority=payload.priority.upper(),
        status=payload.status.upper(),
        hours_spent=payload.hours_spent,
        blockers=payload.blockers,
    )
    db.add(task)
    sheet.total_hours = (sheet.total_hours or 0.0) + payload.hours_spent
    await db.commit()
    await db.refresh(task)

    return TaskItemOut(
        id=task.id,
        sheet_id=task.sheet_id,
        title=task.title,
        description=task.description,
        category=task.category,
        priority=task.priority,
        status=task.status,
        hours_spent=task.hours_spent,
        blockers=task.blockers,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.put("/tasks/{task_id}", response_model=TaskItemOut)
async def update_task_item(
    task_id: str,
    payload: TaskItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    task = (await db.execute(select(TaskItem).where(TaskItem.id == task_id))).scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task item not found")

    sheet = (await db.execute(select(TaskSheet).where(TaskSheet.id == task.sheet_id))).scalars().first()
    if current_user.role == RoleEnum.EMPLOYEE.value and sheet and sheet.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.category is not None:
        task.category = payload.category
    if payload.priority is not None:
        task.priority = payload.priority.upper()
    if payload.status is not None:
        task.status = payload.status.upper()
    if payload.hours_spent is not None:
        task.hours_spent = payload.hours_spent
    if payload.blockers is not None:
        task.blockers = payload.blockers

    # Recalculate parent sheet total hours
    all_tasks = (await db.execute(select(TaskItem).where(TaskItem.sheet_id == task.sheet_id))).scalars().all()
    if sheet:
        sheet.total_hours = sum(t.hours_spent for t in all_tasks)

    await db.commit()
    await db.refresh(task)

    return TaskItemOut(
        id=task.id,
        sheet_id=task.sheet_id,
        title=task.title,
        description=task.description,
        category=task.category,
        priority=task.priority,
        status=task.status,
        hours_spent=task.hours_spent,
        blockers=task.blockers,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_item(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    task = (await db.execute(select(TaskItem).where(TaskItem.id == task_id))).scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task item not found")

    sheet = (await db.execute(select(TaskSheet).where(TaskSheet.id == task.sheet_id))).scalars().first()
    if current_user.role == RoleEnum.EMPLOYEE.value and sheet and sheet.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    sheet_id = task.sheet_id
    await db.delete(task)
    await db.flush()

    if sheet:
        all_tasks = (await db.execute(select(TaskItem).where(TaskItem.sheet_id == sheet_id))).scalars().all()
        sheet.total_hours = sum(t.hours_spent for t in all_tasks)

    await db.commit()
    return None


@router.post("/{sheet_id}/review", response_model=TaskSheetOut)
async def review_task_sheet(
    sheet_id: str,
    payload: TaskSheetReview,
    db: AsyncSession = Depends(get_db),
    manager_or_admin: Employee = Depends(require_role([RoleEnum.ADMIN, RoleEnum.MANAGER])),
):
    stmt = (
        select(TaskSheet)
        .options(
            selectinload(TaskSheet.employee).selectinload(Employee.department),
            selectinload(TaskSheet.reviewer),
            selectinload(TaskSheet.tasks),
        )
        .where(TaskSheet.id == sheet_id)
    )
    sheet = (await db.execute(stmt)).scalars().first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Task sheet not found")

    sheet.manager_feedback = payload.manager_feedback
    sheet.status = payload.status.upper() if payload.status else TaskSheetStatusEnum.APPROVED.value
    sheet.reviewed_by_id = manager_or_admin.id
    sheet.reviewed_at = datetime.now(timezone.utc)

    await db.commit()
    return _populate_sheet_out(sheet)
