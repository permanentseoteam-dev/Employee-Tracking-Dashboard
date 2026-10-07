from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DepartmentBase(BaseModel):
    name: str
    code: str


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: str | None = None
    code: str | None = None


class DepartmentOut(DepartmentBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
