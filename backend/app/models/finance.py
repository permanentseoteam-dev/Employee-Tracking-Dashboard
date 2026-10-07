import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class FinanceMessage(Base):
    __tablename__ = "finance_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False, index=True)
    recipient_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("employees.id"), nullable=True, index=True)

    recipient_name: Mapped[str] = mapped_column(String(150), nullable=False)
    recipient_code: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    recipient_department: Mapped[str] = mapped_column(String(100), nullable=False, default="General")

    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    message_type: Mapped[str] = mapped_column(String(50), default="GENERAL", nullable=False)  # SALARY, BONUS, REIMBURSEMENT, DEDUCTION, GENERAL
    priority: Mapped[str] = mapped_column(String(20), default="NORMAL", nullable=False)  # NORMAL, URGENT

    notify_others: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_broadcast: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sender: Mapped["Employee"] = relationship("Employee", foreign_keys=[sender_id])
    recipient: Mapped["Employee | None"] = relationship("Employee", foreign_keys=[recipient_id])
    notifications: Mapped[list["FinanceNotification"]] = relationship("FinanceNotification", back_populates="message_rel", cascade="all, delete-orphan")


class FinanceNotification(Base):
    __tablename__ = "finance_notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id: Mapped[str] = mapped_column(String(36), ForeignKey("finance_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    target_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(50), default="FINANCE_DIRECT", nullable=False)  # FINANCE_DIRECT, BROADCAST, MANAGER_ALERT
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    message_rel: Mapped["FinanceMessage"] = relationship("FinanceMessage", back_populates="notifications")
    target_user: Mapped["Employee"] = relationship("Employee", foreign_keys=[target_user_id])
