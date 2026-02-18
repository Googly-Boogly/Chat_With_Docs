"""
Documents router — /documents and /upload endpoints.

Handles:
  POST   /upload              Ingest one or more files into the vector store
  GET    /documents           List all ingested document names
  DELETE /documents/{name}    Remove all chunks for a given document
"""

import io
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile

from src.models.document import DeleteResponse, DocumentListResponse, UploadResponse
from src.utils.vector_store import (
    chunk_text,
    collection,
    delete_document_chunks,
    list_document_names,
)

router = APIRouter(tags=["Documents"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _extract_text(file: UploadFile) -> str:
    """Return plain text extracted from an uploaded file.

    Supports ``.pdf``, ``.txt``, and ``.md``.
    """
    content = await file.read()
    filename = (file.filename or "").lower()

    if filename.endswith(".pdf"):
        try:
            import pypdf

            reader = pypdf.PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            raise HTTPException(
                status_code=400,
                detail="pypdf is not installed — cannot parse PDF files.",
            )

    # Plain text fallback (TXT, MD, or anything else UTF-8)
    return content.decode("utf-8", errors="replace")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get(
    "/documents",
    response_model=DocumentListResponse,
    summary="List ingested documents",
)
def get_documents() -> DocumentListResponse:
    """Return the sorted list of unique document names currently in the vector store."""
    return DocumentListResponse(documents=list_document_names())


@router.delete(
    "/documents/{name}",
    response_model=DeleteResponse,
    summary="Delete a document",
)
def delete_document(name: str) -> DeleteResponse:
    """Remove every chunk associated with *name* from the vector store."""
    deleted = delete_document_chunks(name)
    return DeleteResponse(name=name, deleted=deleted)


@router.post(
    "/upload",
    response_model=UploadResponse,
    summary="Upload and ingest documents",
    status_code=201,
)
async def upload_documents(
    files: List[UploadFile] = File(..., description="One or more PDF, TXT, or MD files."),
) -> UploadResponse:
    """Extract text from each file, chunk it, and store embeddings in ChromaDB."""
    total_chunks = 0
    processed_files: list[str] = []

    for file in files:
        if not file.filename:
            continue

        text = await _extract_text(file)
        chunks = chunk_text(text, file.filename)

        if chunks:
            collection.add(
                ids=[c["id"] for c in chunks],
                documents=[c["text"] for c in chunks],
                metadatas=[c["metadata"] for c in chunks],
            )
            total_chunks += len(chunks)

        processed_files.append(file.filename)

    return UploadResponse(files=processed_files, count=total_chunks)