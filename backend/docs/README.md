# Backend — Technical Documentation

## Overview

The backend is a **FastAPI** application that implements a RAG (Retrieval-Augmented Generation) pipeline. It exposes a REST API consumed by the frontend and handles three responsibilities: document ingestion, vector retrieval, and LLM-powered answer generation.

---

## Stack

| Component | Library | Purpose |
|-----------|---------|---------|
| API framework | FastAPI | HTTP server, routing, validation |
| Vector store | ChromaDB (persistent) | Embedding storage and similarity search |
| Embeddings | ChromaDB DefaultEmbeddingFunction | Local sentence-transformer, no external API |
| LLM | Anthropic Claude (`claude-opus-4-6`) | Answer generation |
| PDF parsing | pypdf | Text extraction from PDFs |
| Server | Uvicorn | ASGI server |

---

## RAG Pipeline

### 1. Ingestion (`POST /upload`)

```
File upload
  └─ extract_text()     — decode TXT/MD or parse PDF pages
  └─ chunk_text()       — split into 800-char overlapping chunks (100-char overlap)
  └─ collection.add()   — embed + store in ChromaDB
```

**Chunking strategy** — Fixed-size character chunking with overlap. Overlap ensures sentences split at a boundary are still retrievable from either side. Each chunk stores `source` (filename) and `chunk_index` as metadata.

### 2. Retrieval + Generation (`POST /chat`)

```
Question
  └─ collection.query()         — embed question, cosine similarity against all chunks
  └─ top-K chunks returned      — default K=5
  └─ build context string       — chunks joined with source labels
  └─ claude.messages.create()   — system prompt + context + question → answer
  └─ return answer + sources[]
```

The LLM is instructed to answer **only** from the provided context. If the answer isn't present, it will say so rather than hallucinate.

---

## API Reference

### `GET /documents`
Returns the list of unique document names currently stored.

**Response:**
```json
{ "documents": ["report.pdf", "notes.txt"] }
```

### `DELETE /documents/{name}`
Removes all chunks associated with the given filename.

**Response:**
```json
{ "deleted": 14 }
```

### `POST /upload`
Accepts `multipart/form-data` with one or more files. Supported types: `.pdf`, `.txt`, `.md`.

**Response:**
```json
{ "count": 42, "files": ["doc1.pdf", "doc2.txt"] }
```

### `POST /chat`
Runs the RAG query pipeline.

**Request:**
```json
{ "question": "What are the key findings?" }
```

**Response:**
```json
{
  "answer": "According to the report...",
  "sources": ["report.pdf"]
}
```

Interactive API docs available at `http://localhost:8000/docs` when the server is running.

---

## Configuration

All tunable constants live at the top of `main.py`:

| Constant | Default | Effect |
|----------|---------|--------|
| `CHUNK_SIZE` | `800` | Characters per chunk. Larger = more context per chunk, worse retrieval precision |
| `CHUNK_OVERLAP` | `100` | Characters shared between adjacent chunks. Prevents boundary splits |
| `TOP_K` | `5` | Number of chunks retrieved per query. More = richer context, more tokens |
| `MODEL` | `claude-opus-4-6` | Swap to `claude-sonnet-4-6` for faster/cheaper responses |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic API key from console.anthropic.com |

---

## Data Persistence

ChromaDB stores its SQLite database and embedding index in `./chroma_db/`. In Docker this directory is mounted as a named volume (`chroma_data`) so data survives container restarts.

To fully reset the vector store, remove the Docker volume:
```bash
docker compose down -v
```

---

## Running Locally (without Docker)

```bash
cd backend
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
python main.py
# API available at http://localhost:8000
```