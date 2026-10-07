from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class AttendanceOut(BaseModel):
    id: str
    employee_id: str
    work_date: date
    boot_time: datetime | None
    login_time: datetime | None
    first_activity: datetime | None
    last_activity: datetime | None
    active_seconds: int
    idle_seconds: int
    status: str
    rule_eval_context: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AttendanceSummary(BaseModel):
    employee_id: str
    employee_name: str
    employee_code: str
    department_name: str | None
    work_date: date
    first_activity: datetime | None
    last_activity: datetime | None
    active_hours: float
    idle_hours: float
    status: str
    shift_ended: bool = False

