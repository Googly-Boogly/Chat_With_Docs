"""
Documents router — /documents and /upload endpoints.

Handles:
  POST   /upload              Ingest one or more files into the vector store
  GET    /documents           List all ingested document names
  DELETE /documents/{name}    Remove all chunks for a given document

Defense Layer 1 — Input Filtering
----------------------------------
Every uploaded document is scanned for known prompt injection signatures before
being stored.  If patterns are found:
  1. The upload still proceeds (so you can observe the attack in action).
  2. A low trust score (0.3) is recorded in the trust registry for that document.
  3. The detected pattern labels are returned in the ``warnings`` field.

At query time, defense mode uses the trust score to exclude chunks from low-trust
sources (Layer 2 — Source Trust Validation).
"""

import io
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile

from src.models.document import DeleteResponse, DocumentListResponse, UploadResponse
from src.utils.defense import scan_text
from src.utils.vector_store import (
    LOW_TRUST_SCORE,
    chunk_text,
    collection,
    delete_document_chunks,
    list_document_names,
    set_trust_score,
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
    """Extract text from each file, scan for injection patterns, chunk, and store in ChromaDB.

    Layer 1 defense runs at ingest time: documents with detected injection signatures are
    flagged, assigned a low trust score (0.3), and their pattern labels returned as warnings.
    The document is still stored — this allows demonstrating the attack before enabling defense.
    """
    total_chunks = 0
    processed_files: list[str] = []
    all_warnings: list[str] = []

    for file in files:
        if not file.filename:
            continue

        text = await _extract_text(file)

        # Layer 1 — Input Filtering: scan the full document text for injection signatures
        injection_labels = scan_text(text)
        if injection_labels:
            set_trust_score(file.filename, LOW_TRUST_SCORE)
            all_warnings.append(
                f"{file.filename}: injection patterns detected "
                f"[{', '.join(injection_labels)}] — trust score set to {LOW_TRUST_SCORE}"
            )

        chunks = chunk_text(text, file.filename)
        if chunks:
            collection.add(
                ids=[c["id"] for c in chunks],
                documents=[c["text"] for c in chunks],
                metadatas=[c["metadata"] for c in chunks],
            )
            total_chunks += len(chunks)

        processed_files.append(file.filename)

    return UploadResponse(files=processed_files, count=total_chunks, warnings=all_warnings)
