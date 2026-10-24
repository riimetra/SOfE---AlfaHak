from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"
    log_level: str = "INFO"
    database_url: str = "sqlite:///./local.db"
    mocks_base_url: str = "http://localhost:8081"
    cors_origins: str = "http://localhost:3000"
    jwt_secret: str = "change-me"
    # Показывать тестовые учётные записи на экране входа (только для демо-стенда)
    demo_mode: bool = True
    # Интеграции: таймаут одного запроса и число повторов при сбое
    integration_timeout_s: float = 5.0
    integration_retries: int = 2

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
