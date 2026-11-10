from functools import lru_cache
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    app_env: str = 'development'
    database_pool_max_size: int = Field(default=4, ge=1, le=30)
    database_url: str = 'postgresql://trippy:local_only@localhost:5432/trippy'
    web_origin: str = 'http://localhost:5173'
    public_base_url: str = 'http://localhost:8000'
    supabase_url: str = ''
    supabase_publishable_key: str = ''
    sslcommerz_mode: str = 'sandbox'
    sslcommerz_store_id: str = ''
    sslcommerz_store_password: str = ''
    request_timeout_seconds: float = Field(default=12, ge=1, le=30)
    @model_validator(mode='after')
    def guard(self):
        if self.app_env not in {'development','staging','production'}:
            raise ValueError('APP_ENV must be development, staging, or production')
        if self.sslcommerz_mode not in {'sandbox','live'}:
            raise ValueError('Payment gateway mode is invalid')
        if self.app_env != 'production' and self.sslcommerz_mode == 'live':
            raise ValueError('Live payments require APP_ENV=production')
        if self.app_env == 'production':
            if not self.public_base_url.startswith('https://') or not self.web_origin.startswith('https://'):
                raise ValueError('Production URLs must use HTTPS')
            if not self.supabase_url.startswith('https://') or not self.supabase_publishable_key:
                raise ValueError('Production authentication is not configured')
            if self.sslcommerz_mode != 'live' or not self.sslcommerz_store_id or not self.sslcommerz_store_password:
                raise ValueError('Live payment merchant credentials are required')
            if 'local_only' in self.database_url or 'localhost' in self.database_url:
                raise ValueError('Production DB credentials missing')
        return self

@lru_cache
def settings() -> Settings:
    return Settings()
