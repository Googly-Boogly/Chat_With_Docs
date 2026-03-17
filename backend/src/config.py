from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_title: str = "RAG Poisoning Demo — Attack & Defense"
    api_version: str = "3.0"

    llm_provider: str = "anthropic"
    llm_model: str = "claude-sonnet-4-20250514"
    llm_api_key: str = ""

    # Defense layer tuning
    # anomaly_threshold: chunks with distance > mean * this value are flagged (semantic anomaly layer)
    anomaly_threshold: float = 1.5
    # trust_threshold: documents below this score have chunks excluded in defense mode (trust layer)
    trust_threshold: float = 0.5

    model_config = {"env_file": ".env"}


settings = Settings()
