from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_title: str = "Chat With Docs Framework API"
    api_version: str = "2.0"

    llm_provider: str = "anthropic"
    llm_model: str = "claude-sonnet-4-20250514"
    llm_api_key: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
