import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False, index=True)
    device_identifier: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hostname: Mapped[str] = mapped_column(String(100), nullable=False)
    os_version: Mapped[str] = mapped_column(String(100), nullable=True)
    agent_version: Mapped[str] = mapped_column(String(50), nullable=True)
    api_token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employee: Mapped["Employee"] = relationship("Employee", back_populates="devices")
