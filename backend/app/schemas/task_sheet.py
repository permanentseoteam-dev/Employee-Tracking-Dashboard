from datetime import date, datetime
from pydantic import BaseModel, Field


class TaskItemBase(BaseModel):
    title: str = Field(..., max_length=250)
    description: str | None = None
    category: str = "General"
    priority: str = "MEDIUM"
    status: str = "TODO"
    hours_spent: float = 0.0
    blockers: str | None = None


class TaskItemCreate(TaskItemBase):
    pass


class TaskItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    priority: str | None = None
    status: str | None = None
    hours_spent: float | None = None
    blockers: str | None = None


class TaskItemOut(TaskItemBase):
    id: str
    sheet_id: str
    created_at: datetime
    updated_at: datetime


class TaskSheetBase(BaseModel):
    sheet_date: date = Field(default_factory=date.today)
    summary_notes: str | None = None
    blockers_summary: str | None = None


class TaskSheetCreate(TaskSheetBase):
    employee_id: str | None = None
    tasks: list[TaskItemCreate] = []


class TaskSheetUpdate(BaseModel):
    summary_notes: str | None = None
    blockers_summary: str | None = None
    status: str | None = None


class TaskSheetReview(BaseModel):
    manager_feedback: str
    status: str = "APPROVED"  # REVIEWED or APPROVED


class TaskSheetOut(BaseModel):
    id: str
    employee_id: str
    sheet_date: date
    status: str
    summary_notes: str | None = None
    blockers_summary: str | None = None
    total_hours: float = 0.0
    manager_feedback: str | None = None
    reviewed_by_id: str | None = None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Computed fields
    employee_name: str | None = None
    employee_code: str | None = None
    department_name: str | None = None
    total_tasks: int = 0
    completed_tasks: int = 0
    progress_percent: int = 0
    tasks: list[TaskItemOut] = []


class TaskSheetStats(BaseModel):
    total_sheets: int = 0
    submitted_sheets: int = 0
    approved_sheets: int = 0
    total_tasks: int = 0
    completed_tasks: int = 0
    total_hours: float = 0.0
    pending_reviews: int = 0
