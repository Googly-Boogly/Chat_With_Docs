# Backend — Technical Documentation

## Overview

The backend is a **FastAPI** application implementing a RAG pipeline with a four-layer security defense system. It handles document ingestion, vector retrieval, attack scenario injection, and LLM-powered answer generation with optional real-time threat analysis.

---

## Stack

| Component | Library | Purpose |
|-----------|---------|---------|
| API framework | FastAPI | HTTP routing, request validation, OpenAPI docs |
| Vector store | ChromaDB (persistent) | Embedding storage and cosine similarity search |
| Embeddings | ChromaDB `DefaultEmbeddingFunction` | Local sentence-transformer — no external embedding API |
| LLM | Multi-provider via `call_llm.py` | Answer generation + Layer 4 judge classification |
| PDF parsing | pypdf | Text extraction from PDF files |
| Server | Uvicorn | ASGI server |
| Config | pydantic-settings | Environment variable parsing with validation |

---

## Module Structure

```
backend/
├── Dockerfile.prod
├── requirements.txt
├── .env.example
├── docs/
│   └── README.md          This file
└── src/
    ├── main.py            FastAPI app — mounts all routers
    ├── config.py          Pydantic Settings (env vars + defaults)
    ├── models/
    │   ├── chat.py        ChatRequest, ChatResponse, (imports ThreatReport)
    │   └── document.py    UploadResponse, DocumentListResponse, DeleteResponse
    ├── routers/
    │   ├── chat.py        POST /chat — RAG pipeline + four-layer defense
    │   ├── documents.py   POST /upload, GET /documents, DELETE /documents/{name}
    │   └── demo.py        GET /demo/scenarios, POST /demo/inject/{id}, DELETE /demo/reset
    └── utils/
        ├── defense.py     Core defense engine (all four layers)
        ├── vector_store.py ChromaDB singleton + trust registry
        └── call_llm.py    Multi-provider LLM abstraction
```

---

## Four-Layer Defense Pipeline

### Layer 1 — Input Filtering (upload time)

Defined in `defense.py`. `scan_text(text)` checks the full document text against 18 regex patterns covering known injection techniques (instruction overrides, jailbreak markers, system-tag injections, etc.).

If patterns are found:
- `set_trust_score(filename, 0.3)` is called on the trust registry
- Pattern labels are returned in `UploadResponse.warnings`
- The document is **still stored** — so you can observe the attack before defense is toggled on

### Layer 4 — LLM-as-Judge (pre-retrieval, query time)

Defined in `defense.py`. `judge_query(query)` sends the user's query to the LLM with `JUDGE_SYSTEM_PROMPT` — a strict binary classifier prompt.

- Runs **before** `retrieve_chunks()` is called
- If `is_injection=True` and `confidence >= 0.7` (`JUDGE_BLOCK_THRESHOLD`): request is short-circuited, no documents are retrieved
- On any LLM or parse failure: defaults to `is_injection=False` (fail open) to avoid blocking legitimate traffic on outage
- Result stored in `ThreatReport.query_judge` as a `JudgeReport`

### Layer 2 — Source Trust Validation (query time)

`retrieve_chunks()` in `vector_store.py` injects `trust_score` from the in-memory trust registry into each chunk's metadata dict. `analyze_retrieval()` in `defense.py` then flags chunks where `trust_score < trust_threshold` (default 0.5).

### Layer 3 — Semantic Anomaly Detection (query time)

Also in `analyze_retrieval()`. Computes the mean retrieval distance across all returned chunks. Chunks with `distance > mean × anomaly_threshold` (default 1.5) are flagged as statistically anomalous — they ranked highly despite being semantically distant from the query.

### Mitigation

`filter_chunks()` removes all flagged chunk indices (union of Layer 1/2/3 findings) from the retrieval set before context is assembled. If no safe chunks remain, the pipeline returns early with a defense notice.

---

## RAG Pipeline (with defense)

```
POST /chat
  │
  ├─ defense_mode=True?
  │    └─ Layer 4: await judge_query(question)
  │         └─ judge.blocked? → return ThreatReport, no retrieval
  │
  ├─ retrieve_chunks(question)
  │    └─ ChromaDB cosine similarity → (texts, metas, distances)
  │    └─ trust scores injected into metas from registry
  │
  ├─ defense_mode=True?
  │    └─ analyze_retrieval(chunks, metas, distances, judge=judge)
  │         ├─ Layer 1: scan each chunk text for injection signatures
  │         ├─ Layer 2: flag chunks where trust_score < threshold
  │         └─ Layer 3: flag chunks where distance > mean × threshold
  │    └─ filter_chunks() → remove flagged chunks
  │    └─ no chunks left? → return ThreatReport, no LLM call
  │
  ├─ build context string from safe chunks
  ├─ await call_llm(SYSTEM_PROMPT, context + question)
  └─ return ChatResponse(answer, sources, chunks_used, threat_report)
```

---

## API Reference

Interactive docs: `http://localhost:8000/docs`

### `GET /documents`

List all ingested document names.

**Response:**
```json
{ "documents": ["company_security_policy.txt", "product_faq.txt"] }
```

### `DELETE /documents/{name}`

Remove all chunks for a document. Also clears its trust score from the registry.

**Response:**
```json
{ "name": "prompt_injection.txt", "deleted": 3 }
```

### `POST /upload`

Ingest one or more files (`multipart/form-data`). Supported: `.pdf`, `.txt`, `.md`.

Runs Layer 1 input filtering on every file. Flagged files are stored with `trust_score = 0.3`.

**Response:**
```json
{
  "files": ["prompt_injection.txt"],
  "count": 2,
  "warnings": [
    "prompt_injection.txt: injection patterns detected [instruction override, behavioral override] — trust score set to 0.3"
  ]
}
```

### `POST /chat`

Run the RAG pipeline.

**Request:**
```json
{
  "question": "What is the password policy?",
  "defense_mode": true
}
```

**Response:**
```json
{
  "answer": "The password policy requires a minimum of 14 characters...",
  "sources": ["company_security_policy.txt"],
  "chunks_used": 3,
  "threat_report": {
    "flagged": true,
    "patterns_found": ["instruction override"],
    "low_trust_chunk_indices": [1],
    "anomalous_chunk_indices": [1],
    "distances": [0.21, 0.89, 0.24],
    "trust_scores": [1.0, 0.3, 1.0],
    "chunks_removed": 1,
    "query_judge": {
      "is_injection": false,
      "confidence": 0.05,
      "attack_type": null,
      "reasoning": "Legitimate policy question.",
      "blocked": false,
      "error": null
    },
    "summary": "THREAT DETECTED — Layer 1 signatures [instruction override]; Layer 2: 1 low-trust source(s)"
  }
}
```

`threat_report` is `null` when `defense_mode=false`.

### `GET /demo/scenarios`

List the three pre-built attack scenarios (payloads omitted from listing).

**Response:**
```json
{
  "scenarios": [
    {
      "id": "prompt_injection",
      "name": "Direct Prompt Injection",
      "attack_class": "OWASP LLM01 — Prompt Injection",
      "description": "...",
      "trigger_query": "What is the password policy at ACME?",
      "defense_layers_triggered": ["Input Filtering (Layer 1)", "Semantic Anomaly (Layer 3)"]
    },
    ...
  ]
}
```

### `POST /demo/inject/{scenario_id}`

Inject a scenario payload directly into ChromaDB, bypassing the upload filter. Trust score remains 1.0 (full). Simulates a DB-level or supply-chain compromise.

Query params: `source_name` (optional) — custom filename for the injected doc.

**Response:**
```json
{
  "scenario_id": "prompt_injection",
  "source_name": "injected_prompt_injection_a3f1b2.txt",
  "chunks_injected": 2,
  "trigger_query": "What is the password policy at ACME?",
  "attack_class": "OWASP LLM01 — Prompt Injection",
  "note": "Injected directly into ChromaDB — upload filter bypassed. Trust score is 1.0 (full trust)."
}
```

### `DELETE /demo/reset`

Delete all document chunks from ChromaDB and clear the trust registry.

**Response:**
```json
{
  "deleted_chunks": 18,
  "trust_registry_cleared": true,
  "message": "Reset complete. Deleted 18 chunk(s) and cleared trust registry."
}
```

### `GET /health`

Health check for Docker Compose.

**Response:**
```json
{
  "status": "ok",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "anomaly_threshold": 1.5,
  "trust_threshold": 0.5
}
```

---

## Configuration

Set in `backend/.env` (local dev) or root `.env` (Docker Compose).

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `anthropic` | `anthropic` \| `openai` \| `google` |
| `LLM_API_KEY` | — | API key for the selected provider |
| `LLM_MODEL` | `claude-sonnet-4-20250514` | Model ID passed to the provider |
| `ANOMALY_THRESHOLD` | `1.5` | Distance multiplier above mean that triggers Layer 3 flagging |
| `TRUST_THRESHOLD` | `0.5` | Chunks with trust score below this are excluded in defense mode |

**Chunking constants** (in `vector_store.py`, not env-configurable):

| Constant | Value | Effect |
|----------|-------|--------|
| `CHUNK_SIZE` | `800` | Characters per chunk |
| `CHUNK_OVERLAP` | `100` | Overlap between adjacent chunks |
| `TOP_K` | `5` | Chunks retrieved per query |
| `LOW_TRUST_SCORE` | `0.3` | Trust score assigned to flagged documents at upload |

**Judge constant** (in `defense.py`):

| Constant | Value | Effect |
|----------|-------|--------|
| `JUDGE_BLOCK_THRESHOLD` | `0.7` | Minimum confidence to block a query in Layer 4 |

---

## Trust Registry

The trust registry is an in-memory `dict[str, float]` in `vector_store.py`:

```
_trust_registry: { "filename.txt": 0.3, "clean_doc.txt": 1.0, ... }
```

- Populated at upload time by `set_trust_score()` when Layer 1 detects injection patterns
- Queried at retrieval time — `retrieve_chunks()` injects `trust_score` into each chunk's metadata
- Cleared on `DELETE /demo/reset`
- Clears individual entries on `DELETE /documents/{name}`
- **Resets on server restart** — acceptable for a demo; production would persist alongside ChromaDB

---

## Data Persistence

ChromaDB stores its SQLite index in `./chroma_db/`. In Docker, this is a named volume (`chroma_data`) that survives container restarts. The trust registry does not persist across restarts.

```bash
# Wipe ChromaDB volume entirely
docker compose down -v
```

---

## Running Locally

```bash
cd backend
pip install -r requirements.txt

# Create .env
cp .env.example .env
# Edit .env: set LLM_PROVIDER and LLM_API_KEY

uvicorn src.main:app --reload --port 8000
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```
