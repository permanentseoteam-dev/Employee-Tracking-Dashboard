from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr


class EmployeeBase(BaseModel):
    employee_code: str
    name: str
    email: EmailStr
    role: str = "EMPLOYEE"
    status: str = "ACTIVE"
    department_id: str | None = None
    manager_id: str | None = None


class EmployeeCreate(EmployeeBase):
    password: str


class EmployeeUpdate(BaseModel):
    employee_code: str | None = None
    name: str | None = None
    email: EmailStr | None = None
    role: str | None = None
    status: str | None = None
    department_id: str | None = None
    manager_id: str | None = None
    password: str | None = None


class EmployeeOut(BaseModel):
    id: str
    employee_code: str
    name: str
    email: str
    role: str
    status: str
    department_id: str | None
    manager_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
