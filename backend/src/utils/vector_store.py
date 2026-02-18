"""
Shared ChromaDB vector store instance and helper functions.

A single persistent ChromaDB client is created at import time and reused
across the entire application lifetime.  Both the documents and chat routers
import from here so they always operate on the same collection.
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
    return len(ids_to_delete)


def retrieve_chunks(query: str, k: int = TOP_K) -> tuple[list[str], list[dict]]:
    """Embed *query* and return the top-*k* most similar chunks + their metadata.

    Returns a (texts, metadatas) tuple.  Both lists are empty when the
    collection contains no documents.
    """
    count = collection.count()
    if count == 0:
        return [], []

    results = collection.query(
        query_texts=[query],
        n_results=min(k, count),
        include=["documents", "metadatas"],
    )
    texts = results["documents"][0] if results["documents"] else []
    metas = results["metadatas"][0] if results["metadatas"] else []
    return texts, metas