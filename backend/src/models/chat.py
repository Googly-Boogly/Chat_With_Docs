"""Pydantic models for the /chat router."""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Request body for POST /chat."""

    question: str = Field(
        min_length=1,
        description="The user's question to answer from the uploaded documents.",
    )


class SourceReference(BaseModel):
    """A single document source that contributed to an answer."""

    filename: str = Field(description="Original filename of the source document.")
    chunk_index: int = Field(description="Zero-based chunk index within the document.")


class ChatResponse(BaseModel):
    """Response body for POST /chat."""

    answer: str = Field(description="LLM-generated answer grounded in the retrieved context.")
    sources: list[str] = Field(
        description="Deduplicated list of source document filenames used to generate the answer."
    )
    chunks_used: int = Field(description="Number of document chunks passed as context to the LLM.")