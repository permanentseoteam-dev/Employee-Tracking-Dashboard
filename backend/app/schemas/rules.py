from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class SettingRuleBase(BaseModel):
    rule_type: str  # "ATTENDANCE", "STAR", "MONITORING", "RETENTION", "CUSTOM"
    name: str
    description: str | None = None
    is_active: bool = True
    config_payload: dict = {}


class SettingRuleCreate(SettingRuleBase):
    pass


class SettingRuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
    config_payload: dict | None = None


class SettingRuleOut(SettingRuleBase):
    id: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeStarOut(BaseModel):
    id: str
    employee_id: str
    award_date: date
    star_count: int
    reason: str
    criteria_snapshot: dict | None
    awarded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardMetricsOut(BaseModel):
    total_employees: int
    present_today: int
    late_today: int
    absent_today: int
    offline_today: int
    average_attendance_pct: float
    total_stars_awarded: int
