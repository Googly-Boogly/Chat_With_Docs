"""Pydantic models for the /chat router."""

from pydantic import BaseModel, Field

from src.utils.defense import ThreatReport  # re-exported for OpenAPI schema inclusion


class ChatRequest(BaseModel):
    """Request body for POST /chat."""

    question: str = Field(
        min_length=1,
        description="The user's question to answer from the uploaded documents.",
    )
    defense_mode: bool = Field(
        False,
        description=(
            "Enable all three defense layers: injection pattern scanning, "
            "source trust validation, and semantic anomaly detection. "
            "Flagged chunks are excluded from LLM context before generation."
        ),
    )


class ChatResponse(BaseModel):
    """Response body for POST /chat."""

    answer: str = Field(description="LLM-generated answer grounded in the retrieved context.")
    sources: list[str] = Field(
        description="Deduplicated list of source document filenames used to generate the answer."
    )
    chunks_used: int = Field(description="Number of document chunks passed as context to the LLM.")
    threat_report: ThreatReport | None = Field(
        None,
        description="Defense analysis report. Populated only when defense_mode=True.",
    )
