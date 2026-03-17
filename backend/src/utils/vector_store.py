"""
Shared ChromaDB vector store instance and helper functions.

A single persistent ChromaDB client is created at import time and reused
across the entire application lifetime.  All routers import from here so
they always operate on the same collection and trust registry.

Trust Registry
--------------
Documents flagged at upload time (Layer 1 — Input Filtering) are assigned a
reduced trust_score in the module-level ``_trust_registry`` dict.  When chunks
are retrieved, their source's trust score is injected into the metadata dict so
the defense pipeline (Layer 2 — Source Validation) can access it without a
second DB round-trip.

Note: the registry is in-memory and resets on server restart.  For production
persistence, store it alongside the ChromaDB volume.
"""

import uuid

import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

# ── Constants ─────────────────────────────────────────────────────────────────
CHUNK_SIZE = 800     # characters per chunk
CHUNK_OVERLAP = 100  # overlap between adjacent chunks
TOP_K = 5            # default number of chunks to retrieve per query

# ── Singleton client + collection ─────────────────────────────────────────────
_client = chromadb.PersistentClient(path="./chroma_db")

collection = _client.get_or_create_collection(
    name="documents",
    embedding_function=DefaultEmbeddingFunction(),
)

# ── Trust registry ────────────────────────────────────────────────────────────
# filename → trust_score (0.0 = fully untrusted, 1.0 = fully trusted)
# Documents flagged during upload scanning are set to LOW_TRUST_SCORE.
_trust_registry: dict[str, float] = {}

LOW_TRUST_SCORE = 0.3   # assigned to documents with detected injection patterns
DEFAULT_TRUST = 1.0     # all documents start fully trusted


def set_trust_score(filename: str, score: float) -> None:
    """Record a trust score for *filename* in the registry."""
    _trust_registry[filename] = max(0.0, min(1.0, score))


def get_trust_score(filename: str) -> float:
    """Return the trust score for *filename* (defaults to 1.0 if not registered)."""
    return _trust_registry.get(filename, DEFAULT_TRUST)


def get_trust_registry() -> dict[str, float]:
    """Return a copy of the full trust registry (for inspection / API endpoints)."""
    return dict(_trust_registry)


def clear_trust_registry() -> None:
    """Remove all trust score entries (used by demo reset)."""
    _trust_registry.clear()


# ── Text helpers ──────────────────────────────────────────────────────────────

def chunk_text(text: str, filename: str) -> list[dict]:
    """Split *text* into overlapping fixed-size chunks.

    Each returned dict has the keys expected by ``collection.add()``:
    ``id``, ``text`` (used as the document string), and ``metadata``.
    """
    chunks: list[dict] = []
    start = 0
    chunk_index = 0

    while start < len(text):
        end = start + CHUNK_SIZE
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(
                {
                    "id": f"{filename}_{chunk_index}_{uuid.uuid4().hex[:8]}",
                    "text": chunk,
                    "metadata": {
                        "source": filename,
                        "chunk_index": chunk_index,
                    },
                }
            )
        start = end - CHUNK_OVERLAP
        chunk_index += 1

    return chunks


def list_document_names() -> list[str]:
    """Return a sorted list of unique source document names in the collection."""
    results = collection.get(include=["metadatas"])
    names = sorted({m["source"] for m in (results["metadatas"] or [])})
    return names


def delete_document_chunks(name: str) -> int:
    """Remove every chunk whose ``source`` metadata matches *name*.

    Also clears the document's trust score from the registry.
    Returns the number of chunks deleted.
    """
    results = collection.get(include=["metadatas"])
    ids_to_delete = [
        results["ids"][i]
        for i, m in enumerate(results["metadatas"] or [])
        if m.get("source") == name
    ]
    if ids_to_delete:
        collection.delete(ids=ids_to_delete)
    _trust_registry.pop(name, None)
    return len(ids_to_delete)


def retrieve_chunks(
    query: str, k: int = TOP_K
) -> tuple[list[str], list[dict], list[float]]:
    """Embed *query* and return the top-*k* most similar chunks, metadata, and distances.

    Trust scores are injected into each metadata dict so the defense pipeline
    can inspect them without an additional DB lookup.

    Returns:
        (texts, metadatas, distances) — all three lists empty when collection is empty.
    """
    count = collection.count()
    if count == 0:
        return [], [], []

    results = collection.query(
        query_texts=[query],
        n_results=min(k, count),
        include=["documents", "metadatas", "distances"],
    )
    texts: list[str] = results["documents"][0] if results["documents"] else []
    metas: list[dict] = results["metadatas"][0] if results["metadatas"] else []
    distances: list[float] = results["distances"][0] if results["distances"] else []

    # Inject trust scores into metadata for downstream defense analysis
    for m in metas:
        m["trust_score"] = get_trust_score(m.get("source", ""))

    return texts, metas, distances
