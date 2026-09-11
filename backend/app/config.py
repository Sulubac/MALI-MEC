from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    APP_NAME: str = "PNGA - Plateforme Nationale de Gestion des Archives"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "pnga-djibouti-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://pnga:pnga_secure_2024@postgres:5432/pnga_db"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    REDIS_PASSWORD: Optional[str] = None

    # Elasticsearch
    ELASTICSEARCH_URL: str = "http://elasticsearch:9200"
    ELASTICSEARCH_INDEX_PREFIX: str = "pnga"

    # MinIO / S3
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "pnga_admin"
    MINIO_SECRET_KEY: str = "pnga_secure_storage_2024"
    MINIO_BUCKET_DOCUMENTS: str = "documents"
    MINIO_BUCKET_THUMBNAILS: str = "thumbnails"
    MINIO_BUCKET_TEMP: str = "temp"
    MINIO_USE_SSL: bool = False

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # AI / LLM
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = "anthropic"
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

    # OCR
    TESSERACT_LANG: str = "fra+ara+eng+som"
    OCR_ENGINE: str = "tesseract"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8080",
        "https://pnga.dj",
        "https://archives.gouv.dj",
    ]

    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 500
    ALLOWED_FILE_TYPES: List[str] = [
        "application/pdf",
        "image/tiff", "image/jpeg", "image/png", "image/gif",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "text/xml", "application/xml",
        "application/zip", "application/x-zip-compressed",
        "video/mp4", "audio/mpeg", "audio/wav",
    ]

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # Blockchain
    BLOCKCHAIN_ENABLED: bool = False
    BLOCKCHAIN_NODE_URL: Optional[str] = None

    # Email
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@archives.gouv.dj"

    # SMS
    SMS_PROVIDER: Optional[str] = None
    SMS_API_KEY: Optional[str] = None

    # Monitoring
    PROMETHEUS_ENABLED: bool = True
    SENTRY_DSN: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
