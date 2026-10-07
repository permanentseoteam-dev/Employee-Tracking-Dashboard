from app.schemas.auth import LoginRequest, TokenPayload, TokenResponse
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate
from app.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate
from app.schemas.device import (
    DeviceHeartbeatRequest,
    DeviceOut,
    DeviceRegisterRequest,
    DeviceRegisterResponse,
)
from app.schemas.attendance import AttendanceOut, AttendanceSummary
from app.schemas.activity import (
    ActivityBatchItem,
    ActivityStatsOut,
    AgentSyncPayload,
    AgentSyncResponse,
    HeatmapBatchItem,
    MouseHeatmapOut,
    SystemEventItem,
)
from app.schemas.screenshot import (
    PaginatedScreenshots,
    ScreenshotOut,
    ScreenshotUploadResponse,
)
from app.schemas.rules import (
    DashboardMetricsOut,
    EmployeeStarOut,
    SettingRuleCreate,
    SettingRuleOut,
    SettingRuleUpdate,
)
from app.schemas.task_sheet import (
    TaskItemCreate,
    TaskItemOut,
    TaskItemUpdate,
    TaskSheetCreate,
    TaskSheetOut,
    TaskSheetReview,
    TaskSheetStats,
    TaskSheetUpdate,
)

__all__ = [
    "LoginRequest",
    "TokenResponse",
    "TokenPayload",
    "DepartmentCreate",
    "DepartmentUpdate",
    "DepartmentOut",
    "EmployeeCreate",
    "EmployeeUpdate",
    "EmployeeOut",
    "DeviceRegisterRequest",
    "DeviceRegisterResponse",
    "DeviceHeartbeatRequest",
    "DeviceOut",
    "AttendanceOut",
    "AttendanceSummary",
    "SystemEventItem",
    "ActivityBatchItem",
    "HeatmapBatchItem",
    "AgentSyncPayload",
    "AgentSyncResponse",
    "ActivityStatsOut",
    "MouseHeatmapOut",
    "ScreenshotUploadResponse",
    "ScreenshotOut",
    "PaginatedScreenshots",
    "SettingRuleCreate",
    "SettingRuleUpdate",
    "SettingRuleOut",
    "EmployeeStarOut",
    "DashboardMetricsOut",
    "TaskItemCreate",
    "TaskItemUpdate",
    "TaskItemOut",
    "TaskSheetCreate",
    "TaskSheetUpdate",
    "TaskSheetReview",
    "TaskSheetOut",
    "TaskSheetStats",
]
