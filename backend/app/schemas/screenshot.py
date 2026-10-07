from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ScreenshotUploadResponse(BaseModel):
    screenshot_id: str
    employee_id: str
    s3_key: str
    captured_at: datetime
    file_size_bytes: int


class ScreenshotOut(BaseModel):
    id: str
    employee_id: str
    employee_name: str | None = None
    device_id: str | None = None
    s3_key: str
    image_url: str  # Presigned or direct URL
    file_size_bytes: int
    format: str
    width: int
    height: int
    captured_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedScreenshots(BaseModel):
    items: list[ScreenshotOut]
    total: int
    page: int
    limit: int
    total_pages: int
