from datetime import datetime
from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False, index=True)
    device_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("devices.id"), nullable=True)
    
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    key_press_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    mouse_click_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    mouse_move_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    active_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    idle_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employee: Mapped["Employee"] = relationship("Employee", back_populates="activity_logs")


class MouseHeatmap(Base):
    __tablename__ = "mouse_heatmaps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False, index=True)
    device_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("devices.id"), nullable=True)
    
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    screen_width: Mapped[int] = mapped_column(Integer, nullable=False)
    screen_height: Mapped[int] = mapped_column(Integer, nullable=False)
    grid_cols: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    grid_rows: Mapped[int] = mapped_column(Integer, default=12, nullable=False)
    
    # Store sparse or dense grid counts: {"0,0": 5, "1,2": 10}
    grid_matrix: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employee: Mapped["Employee"] = relationship("Employee", back_populates="mouse_heatmaps")
