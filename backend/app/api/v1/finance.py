from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models.audit import AuditLog
from app.models.department import Department
from app.models.employee import Employee, RoleEnum
from app.models.finance import FinanceMessage, FinanceNotification
from app.schemas.finance import (
    FinanceMessageCreate,
    FinanceMessageOut,
    FinanceNotificationOut,
    FinanceSummaryOut,
)

router = APIRouter(prefix="/finance", tags=["Finance & Compensation"])


@router.get("/summary", response_model=FinanceSummaryOut)
async def get_finance_summary(
    db: AsyncSession = Depends(get_db),
    _user: Employee = Depends(require_role([RoleEnum.ADMIN])),
):
    total_msgs_res = await db.execute(select(func.count(FinanceMessage.id)))
    total_messages = total_msgs_res.scalar() or 0

    direct_res = await db.execute(select(func.count(FinanceMessage.id)).where(FinanceMessage.is_broadcast == False))
    direct_notices = direct_res.scalar() or 0

    broadcast_res = await db.execute(select(func.count(FinanceMessage.id)).where(FinanceMessage.is_broadcast == True))
    broadcast_notices = broadcast_res.scalar() or 0

    amount_res = await db.execute(select(func.sum(FinanceMessage.amount)).where(FinanceMessage.amount.isnot(None)))
    total_amount = amount_res.scalar() or 0.0

    emp_res = await db.execute(select(func.count(Employee.id)).where(Employee.status == "ACTIVE"))
    total_employees = emp_res.scalar() or 0

    return FinanceSummaryOut(
        total_messages=total_messages,
        direct_notices=direct_notices,
        broadcast_notices=broadcast_notices,
        total_amount_disbursed=round(float(total_amount), 2),
        total_employees=total_employees,
    )


@router.get("/messages", response_model=list[FinanceMessageOut])
async def list_finance_messages(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_role([RoleEnum.ADMIN])),
):
    stmt = select(FinanceMessage).order_by(desc(FinanceMessage.created_at)).limit(limit)
    res = await db.execute(stmt)
    messages = res.scalars().all()

    # Pre-fetch sender names
    sender_ids = {m.sender_id for m in messages}
    senders = {}
    if sender_ids:
        s_res = await db.execute(select(Employee).where(Employee.id.in_(sender_ids)))
        senders = {s.id: s.name for s in s_res.scalars().all()}

    output = []
    for m in messages:
        output.append(
            FinanceMessageOut(
                id=m.id,
                sender_id=m.sender_id,
                sender_name=senders.get(m.sender_id, "System Admin"),
                recipient_id=m.recipient_id,
                recipient_name=m.recipient_name,
                recipient_code=m.recipient_code,
                recipient_department=m.recipient_department,
                subject=m.subject,
                message=m.message,
                amount=m.amount,
                message_type=m.message_type,
                priority=m.priority,
                notify_others=m.notify_others,
                is_broadcast=m.is_broadcast,
                is_read=m.is_read,
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
        )
    return output


@router.post("/messages", response_model=FinanceMessageOut, status_code=status.HTTP_201_CREATED)
async def create_finance_message(
    payload: FinanceMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_role([RoleEnum.ADMIN])),
):
    """
    ADMIN ONLY: Sends a finance message to a specific employee or all staff.
    Creates delivery notifications for the employee and team leads/managers.
    """
    is_broadcast = payload.recipient_id in (None, "", "ALL")

    if is_broadcast:
        recipient_id = None
        recipient_name = "All Employees"
        recipient_code = "ALL"
        recipient_department = "All Departments"
    else:
        emp_stmt = select(Employee).options(selectinload(Employee.department)).where(Employee.id == payload.recipient_id)
        emp_res = await db.execute(emp_stmt)
        emp = emp_res.scalars().first()
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target employee '{payload.recipient_id}' not found",
            )
        recipient_id = emp.id
        recipient_name = emp.name
        recipient_code = emp.employee_code
        recipient_department = emp.department.name if emp.department else "General"

    msg = FinanceMessage(
        sender_id=current_user.id,
        recipient_id=recipient_id,
        recipient_name=recipient_name,
        recipient_code=recipient_code,
        recipient_department=recipient_department,
        subject=payload.subject,
        message=payload.message,
        amount=payload.amount,
        message_type=payload.message_type.upper(),
        priority=payload.priority.upper(),
        notify_others=payload.notify_others,
        is_broadcast=is_broadcast,
        is_read=False,
    )
    db.add(msg)
    await db.flush()

    # Generate notifications
    created_notifs = []
    if is_broadcast:
        # Broadcast notice to all active employees
        all_emps = (await db.execute(select(Employee).where(Employee.status == "ACTIVE"))).scalars().all()
        for e in all_emps:
            created_notifs.append(
                FinanceNotification(
                    message_id=msg.id,
                    target_user_id=e.id,
                    title=f"📢 Company Finance Announcement: {payload.subject}",
                    body=payload.message[:250],
                    notification_type="BROADCAST",
                )
            )
    else:
        # Direct notification to target employee
        created_notifs.append(
            FinanceNotification(
                message_id=msg.id,
                target_user_id=recipient_id,
                title=f"💰 Finance Notice from Admin: {payload.subject}",
                body=payload.message,
                notification_type="FINANCE_DIRECT",
            )
        )

        # Notify others (manager and leads) if enabled
        if payload.notify_others:
            manager_ids_to_notify = set()
            if emp.manager_id:
                manager_ids_to_notify.add(emp.manager_id)

            # Department managers
            if emp.department_id:
                mgrs_stmt = select(Employee.id).where(
                    Employee.department_id == emp.department_id,
                    Employee.role == RoleEnum.MANAGER.value,
                    Employee.id != current_user.id,
                )
                dept_mgr_ids = (await db.execute(mgrs_stmt)).scalars().all()
                for m_id in dept_mgr_ids:
                    manager_ids_to_notify.add(m_id)

            for m_id in manager_ids_to_notify:
                created_notifs.append(
                    FinanceNotification(
                        message_id=msg.id,
                        target_user_id=m_id,
                        title=f"📋 Finance Update for {emp.name}: {payload.subject}",
                        body=f"Admin sent {payload.message_type} communication to {emp.name} ({recipient_code}): {payload.message[:180]}",
                        notification_type="MANAGER_ALERT",
                    )
                )

    for notif in created_notifs:
        db.add(notif)

    # Record Audit Log
    db.add(
        AuditLog(
            actor_id=current_user.id,
            actor_email=current_user.email,
            action="FINANCE_MESSAGE_SENT",
            entity_type="FINANCE",
            entity_id=msg.id,
            change_diff={
                "subject": payload.subject,
                "recipient_name": recipient_name,
                "recipient_code": recipient_code,
                "message_type": payload.message_type,
                "amount": payload.amount,
                "notified_count": len(created_notifs),
            },
        )
    )

    await db.flush()

    return FinanceMessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        sender_name=current_user.name,
        recipient_id=msg.recipient_id,
        recipient_name=msg.recipient_name,
        recipient_code=msg.recipient_code,
        recipient_department=msg.recipient_department,
        subject=msg.subject,
        message=msg.message,
        amount=msg.amount,
        message_type=msg.message_type,
        priority=msg.priority,
        notify_others=msg.notify_others,
        is_broadcast=msg.is_broadcast,
        is_read=msg.is_read,
        created_at=msg.created_at,
        updated_at=msg.updated_at,
    )


@router.delete("/messages/{message_id}", status_code=status.HTTP_200_OK)
async def delete_finance_message(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: Employee = Depends(require_role([RoleEnum.ADMIN])),
):
    stmt = select(FinanceMessage).where(FinanceMessage.id == message_id)
    msg = (await db.execute(stmt)).scalars().first()
    if not msg:
        raise HTTPException(status_code=404, detail="Finance message not found")

    await db.delete(msg)
    return {"message": "Finance message and associated notifications successfully deleted"}


@router.get("/notifications", response_model=list[FinanceNotificationOut])
async def get_user_notifications(
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    stmt = (
        select(FinanceNotification)
        .where(FinanceNotification.target_user_id == current_user.id)
        .order_by(desc(FinanceNotification.created_at))
        .limit(limit)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.put("/notifications/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    stmt = select(FinanceNotification).where(
        FinanceNotification.id == notif_id,
        FinanceNotification.target_user_id == current_user.id,
    )
    notif = (await db.execute(stmt)).scalars().first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    await db.flush()
    return {"message": "Notification marked as read"}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    stmt = select(FinanceNotification).where(
        FinanceNotification.target_user_id == current_user.id,
        FinanceNotification.is_read == False,
    )
    notifs = (await db.execute(stmt)).scalars().all()
    for n in notifs:
        n.is_read = True
    await db.flush()
    return {"message": f"Marked {len(notifs)} notifications as read"}
