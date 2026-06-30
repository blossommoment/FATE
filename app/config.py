from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FATE Backend"
    api_prefix: str = "/v1"
    environment: str = "local"

    model_config = SettingsConfigDict(env_prefix="FATE_")


settings = Settings()
