from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Employee Tracking Platform"
    API_V1_STR: str = "/api/v1"
    
    # Security / Auth
    SECRET_KEY: str = "insecure-dev-secret-change-in-production-09823475098"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./tracking.db"
    
    # Storage (local or s3)
    STORAGE_TYPE: Literal["local", "s3"] = "local"
    LOCAL_STORAGE_DIR: str = "./storage/screenshots"
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY: str | None = None
    S3_SECRET_KEY: str | None = None
    S3_BUCKET_NAME: str = "employee-screenshots"
    S3_REGION: str = "us-east-1"
    
    # Default Rule Constants
    DEFAULT_SHIFT_START: str = "09:00:00"
    DEFAULT_SHIFT_END: str = "18:00:00"
    DEFAULT_GRACE_MINUTES: int = 10
    DEFAULT_SCREENSHOT_INTERVAL_MINUTES: int = 10
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
