import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Screenshot(Base):
    __tablename__ = "screenshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False, index=True)
    device_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("devices.id"), nullable=True)
    
    s3_key: Mapped[str] = mapped_column(String(255), nullable=False)
    thumbnail_s3_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    format: Mapped[str] = mapped_column(String(10), default="webp", nullable=False)
    width: Mapped[int] = mapped_column(Integer, default=1280, nullable=False)
    height: Mapped[int] = mapped_column(Integer, default=720, nullable=False)
    
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employee: Mapped["Employee"] = relationship("Employee", back_populates="screenshots")
