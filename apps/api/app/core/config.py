from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import secrets


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "StayFlow"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_PREFIX: str = "/api/v1"

    # Security
    SECRET_KEY: str = secrets.token_hex(64)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://stayflow:stayflow_dev_password@localhost:5432/stayflow"
    DATABASE_URL_SYNC: str = "postgresql://stayflow:stayflow_dev_password@localhost:5432/stayflow"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # Redis
    REDIS_URL: str = "redis://:stayflow_redis_password@localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://:stayflow_redis_password@localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://:stayflow_redis_password@localhost:6379/2"

    # Storage
    STORAGE_PROVIDER: str = "minio"
    STORAGE_ENDPOINT_URL: str = "http://localhost:9000"
    STORAGE_ACCESS_KEY: str = "stayflow_minio"
    STORAGE_SECRET_KEY: str = "stayflow_minio_password"
    STORAGE_REGION: str = "us-east-1"
    STORAGE_BUCKET_DOCUMENTS: str = "stayflow-documents"
    STORAGE_BUCKET_PHOTOS: str = "stayflow-photos"
    STORAGE_SIGNED_URL_EXPIRES: int = 3600

    # OCR
    OCR_PROVIDER: str = "mock"
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    # Notifications
    FCM_PROVIDER: str = "log"
    FIREBASE_SERVICE_ACCOUNT_JSON: Optional[str] = None

    # WhatsApp
    WHATSAPP_PROVIDER: str = "disabled"

    # Document retention
    DOCUMENT_RETENTION_DAYS: int = 365

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_AUTH: str = "10/minute"

    # CORS
    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        origins = [
            "http://localhost:3000",
            "http://localhost:8081",
            "http://localhost:19006",
            "exp://localhost:8081",
        ]
        if self.APP_ENV == "production":
            # Add production origins from env
            pass
        return origins

    # Trusted hosts
    @property
    def ALLOWED_HOSTS(self) -> List[str]:
        return ["*"] if self.DEBUG else ["yourdomain.com"]


settings = Settings()
