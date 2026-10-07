import os
from pathlib import Path
from app.config import settings


class StorageService:
    def __init__(self):
        self.storage_type = settings.STORAGE_TYPE
        if self.storage_type == "local":
            self.base_dir = Path(settings.LOCAL_STORAGE_DIR)
            self.base_dir.mkdir(parents=True, exist_ok=True)

    async def save_file(self, file_bytes: bytes, relative_path: str) -> str:
        """Saves file bytes and returns the storage key / relative path."""
        if self.storage_type == "local":
            target_path = self.base_dir / relative_path
            target_path.parent.mkdir(parents=True, exist_ok=True)
            # Use standard open or aiofiles if available
            with open(target_path, "wb") as f:
                f.write(file_bytes)
            return relative_path
        else:
            # S3 / MinIO
            import boto3
            s3_client = boto3.client(
                "s3",
                endpoint_url=settings.S3_ENDPOINT_URL,
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY,
                region_name=settings.S3_REGION,
            )
            s3_client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=relative_path,
                Body=file_bytes,
                ContentType="image/webp",
            )
            return relative_path

    async def get_file_bytes(self, relative_path: str) -> bytes | None:
        if self.storage_type == "local":
            target_path = self.base_dir / relative_path
            if not target_path.exists():
                return None
            with open(target_path, "rb") as f:
                return f.read()
        else:
            import boto3
            s3_client = boto3.client(
                "s3",
                endpoint_url=settings.S3_ENDPOINT_URL,
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY,
                region_name=settings.S3_REGION,
            )
            try:
                response = s3_client.get_object(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=relative_path,
                )
                return response["Body"].read()
            except Exception:
                return None

    async def delete_file(self, relative_path: str) -> bool:
        if self.storage_type == "local":
            target_path = self.base_dir / relative_path
            if target_path.exists():
                target_path.unlink()
                return True
            return False
        else:
            import boto3
            s3_client = boto3.client(
                "s3",
                endpoint_url=settings.S3_ENDPOINT_URL,
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY,
                region_name=settings.S3_REGION,
            )
            try:
                s3_client.delete_object(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=relative_path,
                )
                return True
            except Exception:
                return False

    def get_public_or_signed_url(self, relative_path: str, base_url: str = "") -> str:
        if self.storage_type == "local":
            return f"{base_url}/api/v1/screenshots/file/{relative_path}"
        else:
            import boto3
            s3_client = boto3.client(
                "s3",
                endpoint_url=settings.S3_ENDPOINT_URL,
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY,
                region_name=settings.S3_REGION,
            )
            return s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.S3_BUCKET_NAME, "Key": relative_path},
                ExpiresIn=900,
            )


storage_service = StorageService()
