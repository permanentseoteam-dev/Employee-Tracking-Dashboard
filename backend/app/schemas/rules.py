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


class StarLedgerItem(BaseModel):
    id: str
    date: date
    reason: str
    star_count: int
    rule_type: str
    criteria: dict | None = None
    awarded_at: datetime


class PolicyViolationItem(BaseModel):
    id: str
    date: date
    policy_name: str
    violation_type: str
    severity: str
    details: str
    star_impact: str
    recorded_at: datetime


class PerformanceScorecardOut(BaseModel):
    employee_id: str
    employee_name: str
    employee_code: str
    role: str
    department: str
    total_stars: int
    total_days_logged: int
    on_time_days: int
    late_days: int
    offline_days: int
    punctuality_rate_pct: float
    total_active_hours: float
    avg_daily_active_hours: float
    total_violations_count: int
    stars_ledger: list[StarLedgerItem]
    violations_ledger: list[PolicyViolationItem]
