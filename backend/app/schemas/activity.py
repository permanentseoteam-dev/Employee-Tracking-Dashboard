from datetime import datetime
from pydantic import BaseModel, ConfigDict


class SystemEventItem(BaseModel):
    event_type: str  # "BOOT", "LOGIN", "UNLOCK", "LOGOUT", "LOCK"
    timestamp: datetime


class ActivityBatchItem(BaseModel):
    start_time: datetime
    end_time: datetime
    key_press_count: int
    mouse_click_count: int
    mouse_move_count: int
    active_seconds: int
    idle_seconds: int


class HeatmapBatchItem(BaseModel):
    window_start: datetime
    window_end: datetime
    screen_width: int
    screen_height: int
    grid_cols: int = 20
    grid_rows: int = 12
    grid_matrix: dict[str, int]  # e.g., {"0,0": 12, "1,3": 4}


class AgentSyncPayload(BaseModel):
    system_events: list[SystemEventItem] = []
    activity_batches: list[ActivityBatchItem] = []
    heatmap_batches: list[HeatmapBatchItem] = []


class AgentSyncResponse(BaseModel):
    status: str = "ok"
    synced_events: int
    synced_activity_batches: int
    synced_heatmap_batches: int


class ActivityStatsOut(BaseModel):
    employee_id: str
    date_from: datetime
    date_to: datetime
    total_key_presses: int
    total_mouse_clicks: int
    total_mouse_moves: int
    total_active_seconds: int
    total_idle_seconds: int


class MouseHeatmapOut(BaseModel):
    employee_id: str
    grid_cols: int
    grid_rows: int
    composite_matrix: dict[str, int]
