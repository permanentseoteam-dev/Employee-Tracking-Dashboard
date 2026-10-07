import enum
import uuid
from datetime import date, datetime
from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TaskSheetStatusEnum(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    REVIEWED = "REVIEWED"
    APPROVED = "APPROVED"


class TaskPriorityEnum(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class TaskStatusEnum(str, enum.Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"


class TaskSheet(Base):
    __tablename__ = "task_sheets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False, index=True)
    sheet_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today, index=True)
    status: Mapped[str] = mapped_column(String(30), default=TaskSheetStatusEnum.DRAFT.value, nullable=False, index=True)
    
    summary_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    blockers_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_hours: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # Manager / Admin Review Fields
    manager_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("employees.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])
    reviewer: Mapped["Employee | None"] = relationship("Employee", foreign_keys=[reviewed_by_id])
    tasks: Mapped[list["TaskItem"]] = relationship("TaskItem", back_populates="sheet", cascade="all, delete-orphan", order_by="TaskItem.created_at.asc()")


class TaskItem(Base):
    __tablename__ = "task_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sheet_id: Mapped[str] = mapped_column(String(36), ForeignKey("task_sheets.id", ondelete="CASCADE"), nullable=False, index=True)
    
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="General", nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default=TaskPriorityEnum.MEDIUM.value, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=TaskStatusEnum.TODO.value, nullable=False)
    hours_spent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    blockers: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sheet: Mapped["TaskSheet"] = relationship("TaskSheet", back_populates="tasks")
