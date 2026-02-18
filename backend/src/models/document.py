"""Pydantic models for the /documents router."""

from pydantic import BaseModel, Field


class DocumentListResponse(BaseModel):
    """Response body for GET /documents."""

    documents: list[str] = Field(
        description="Sorted list of unique document filenames currently in the vector store."
    )


class UploadResponse(BaseModel):
    """Response body for POST /upload."""

    files: list[str] = Field(description="Names of the files that were processed.")
    count: int = Field(description="Total number of chunks stored across all uploaded files.")


class DeleteResponse(BaseModel):
    """Response body for DELETE /documents/{name}."""

    name: str = Field(description="The document name that was targeted.")
    deleted: int = Field(description="Number of chunks removed from the vector store.")