import enum
import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    EMPLOYEE = "EMPLOYEE"


class StatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default=RoleEnum.EMPLOYEE.value, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default=StatusEnum.ACTIVE.value, nullable=False)
    
    department_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("departments.id"), nullable=True)
    manager_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("employees.id"), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    department: Mapped["Department"] = relationship("Department", back_populates="employees")
    manager: Mapped["Employee"] = relationship("Employee", remote_side=[id], backref="subordinates")
    devices: Mapped[list["Device"]] = relationship("Device", back_populates="employee", cascade="all, delete-orphan")
    attendances: Mapped[list["Attendance"]] = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")
    activity_logs: Mapped[list["ActivityLog"]] = relationship("ActivityLog", back_populates="employee", cascade="all, delete-orphan")
    mouse_heatmaps: Mapped[list["MouseHeatmap"]] = relationship("MouseHeatmap", back_populates="employee", cascade="all, delete-orphan")
    screenshots: Mapped[list["Screenshot"]] = relationship("Screenshot", back_populates="employee", cascade="all, delete-orphan")
    stars: Mapped[list["EmployeeStar"]] = relationship("EmployeeStar", back_populates="employee", cascade="all, delete-orphan")
