from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DeviceRegisterRequest(BaseModel):
    employee_code: str
    device_identifier: str
    hostname: str
    os_version: str | None = None
    agent_version: str | None = None


class DeviceRegisterResponse(BaseModel):
    device_id: str
    employee_id: str
    api_token: str
    registered_at: datetime


class DeviceHeartbeatRequest(BaseModel):
    agent_version: str | None = None


class DeviceOut(BaseModel):
    id: str
    employee_id: str
    device_identifier: str
    hostname: str
    os_version: str | None
    agent_version: str | None
    last_heartbeat: datetime | None
    status: str
    registered_at: datetime

    model_config = ConfigDict(from_attributes=True)
