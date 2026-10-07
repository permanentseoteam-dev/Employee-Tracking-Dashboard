from datetime import datetime
from pydantic import BaseModel, ConfigDict


class FinanceMessageCreate(BaseModel):
    recipient_id: str | None = None  # None or "ALL" for broadcast
    subject: str
    message: str
    amount: float | None = None
    message_type: str = "GENERAL"  # "SALARY", "BONUS", "REIMBURSEMENT", "DEDUCTION", "GENERAL"
    priority: str = "NORMAL"  # "NORMAL", "URGENT"
    notify_others: bool = True  # Notify manager and post to team notices


class FinanceMessageOut(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    recipient_id: str | None
    recipient_name: str
    recipient_code: str
    recipient_department: str
    subject: str
    message: str
    amount: float | None
    message_type: str
    priority: str
    notify_others: bool
    is_broadcast: bool
    is_read: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FinanceNotificationOut(BaseModel):
    id: str
    message_id: str
    target_user_id: str
    title: str
    body: str
    notification_type: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FinanceSummaryOut(BaseModel):
    total_messages: int
    direct_notices: int
    broadcast_notices: int
    total_amount_disbursed: float
    total_employees: int
