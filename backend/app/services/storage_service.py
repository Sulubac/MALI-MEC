import asyncio
import hashlib
import io
import os
import uuid
from pathlib import Path
from typing import Optional, BinaryIO
import structlog

logger = structlog.get_logger()


class StorageService:
    def __init__(self):
        self.backend = os.getenv("STORAGE_BACKEND", "local")
        self.local_base = Path("/data/storage")
        self.minio_client = None
        self._init_storage()

    def _init_storage(self):
        if self.backend == "minio":
            try:
                from minio import Minio
                from app.config import settings
                self.minio_client = Minio(
                    settings.MINIO_ENDPOINT,
                    access_key=settings.MINIO_ACCESS_KEY,
                    secret_key=settings.MINIO_SECRET_KEY,
                    secure=settings.MINIO_USE_SSL,
                )
                for bucket in ["documents", "thumbnails", "temp"]:
                    if not self.minio_client.bucket_exists(bucket):
                        self.minio_client.make_bucket(bucket)
                logger.info("MinIO storage initialized")
            except Exception as e:
                logger.error("MinIO init failed, falling back to local", error=str(e))
                self.backend = "local"

        if self.backend == "local":
            self.local_base.mkdir(parents=True, exist_ok=True)
            for sub in ["documents", "thumbnails", "temp"]:
                (self.local_base / sub).mkdir(exist_ok=True)
            logger.info("Local storage initialized", path=str(self.local_base))

    async def upload_file(
        self,
        file_data: bytes,
        filename: str,
        bucket: str = "documents",
        content_type: str = "application/octet-stream",
        institution_id: Optional[str] = None,
    ) -> dict:
        ext = Path(filename).suffix.lower()
        unique_name = f"{uuid.uuid4()}{ext}"
        if institution_id:
            object_path = f"{institution_id}/{unique_name}"
        else:
            object_path = unique_name

        file_hash = hashlib.sha256(file_data).hexdigest()
        file_size = len(file_data)

        if self.backend == "minio" and self.minio_client:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: self.minio_client.put_object(
                    bucket, object_path, io.BytesIO(file_data),
                    length=file_size, content_type=content_type,
                )
            )
            url = f"minio://{bucket}/{object_path}"
        else:
            dest = self.local_base / bucket / object_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(file_data)
            url = f"local://{bucket}/{object_path}"

        return {
            "path": f"{bucket}/{object_path}",
            "url": url,
            "size": file_size,
            "hash_sha256": file_hash,
            "hash_md5": hashlib.md5(file_data).hexdigest(),
            "filename": filename,
            "bucket": bucket,
            "object_name": object_path,
        }

    async def download_file(self, path: str) -> Optional[bytes]:
        parts = path.split("/", 1)
        if len(parts) < 2:
            return None
        bucket, object_name = parts[0], parts[1]

        if self.backend == "minio" and self.minio_client:
            try:
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None, lambda: self.minio_client.get_object(bucket, object_name)
                )
                return response.read()
            except Exception as e:
                logger.error("MinIO download failed", error=str(e))
                return None
        else:
            local_path = self.local_base / bucket / object_name
            if local_path.exists():
                return local_path.read_bytes()
            return None

    async def delete_file(self, path: str) -> bool:
        parts = path.split("/", 1)
        if len(parts) < 2:
            return False
        bucket, object_name = parts[0], parts[1]

        if self.backend == "minio" and self.minio_client:
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None, lambda: self.minio_client.remove_object(bucket, object_name)
                )
                return True
            except Exception:
                return False
        else:
            local_path = self.local_base / bucket / object_name
            if local_path.exists():
                local_path.unlink()
                return True
            return False

    async def get_presigned_url(self, path: str, expires_hours: int = 24) -> Optional[str]:
        from datetime import timedelta
        parts = path.split("/", 1)
        if len(parts) < 2:
            return None
        bucket, object_name = parts[0], parts[1]

        if self.backend == "minio" and self.minio_client:
            try:
                loop = asyncio.get_event_loop()
                url = await loop.run_in_executor(
                    None,
                    lambda: self.minio_client.presigned_get_object(
                        bucket, object_name, expires=timedelta(hours=expires_hours)
                    )
                )
                return url
            except Exception:
                return None
        return f"/api/v1/files/{path}"

    async def generate_thumbnail(self, file_path: str, size: tuple = (200, 200)) -> Optional[bytes]:
        try:
            from PIL import Image
            ext = Path(file_path).suffix.lower()

            if ext == ".pdf":
                try:
                    from pdf2image import convert_from_path
                    images = convert_from_path(file_path, first_page=1, last_page=1, dpi=72)
                    if images:
                        img = images[0]
                    else:
                        return None
                except Exception:
                    return None
            elif ext in [".jpg", ".jpeg", ".png", ".tiff", ".tif"]:
                img = Image.open(file_path)
            else:
                return None

            img.thumbnail(size, Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            return buf.getvalue()
        except Exception as e:
            logger.error("Thumbnail generation failed", error=str(e))
            return None


storage_service = StorageService()
