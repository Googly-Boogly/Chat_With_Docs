# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RAG Poisoning Demo — Attack & Defense.** A full-stack security research application that demonstrates how adversarial documents can poison a RAG (Retrieval-Augmented Generation) pipeline, then shows a three-layer mitigation system that detects and neutralizes those attacks in real time.

Two-part structure:
- **Red team (attack):** Three pre-built attack scenarios — direct prompt injection, factual override (data poisoning), and indirect jailbreak — injected via `POST /demo/inject/{id}` or the normal upload endpoint.
- **Blue team (defense):** Three stacked defense layers — input filtering at upload time, source trust validation, and semantic anomaly detection at query time.

## Architecture

```
Frontend (React + Vite)          Backend (FastAPI)              Storage
───────────────────────          ─────────────────              ───────
Nginx serves static +    →      POST /upload                →  ChromaDB
proxies /api to backend           └─ Layer 1: injection scan    (persistent SQLite)
Port 3000                         └─ trust_registry update      ./chroma_db volume
                         →      POST /chat
                                  └─ retrieve_chunks() + distances
                                  └─ Layer 2: trust validation  trust_registry
                                  └─ Layer 3: anomaly detection  (in-memory dict)
                                  └─ filter_chunks()
                                  └─ LLM + ThreatReport
                         →      GET  /demo/scenarios
                                POST /demo/inject/{scenario_id}
                                DEL  /demo/reset
                                Port 8000
```

- **Embeddings** are local via ChromaDB's DefaultEmbeddingFunction (no external API).
- **LLM calls** go through `backend/src/utils/call_llm.py` — supports Anthropic, OpenAI, Google Gemini.
- **RAG pipeline**: chunking (800 chars, 100 overlap) → retrieval (top 5) → defense analysis → LLM generation.

## Key Files

- `backend/src/utils/defense.py` — **Core defense engine**: ThreatReport model, INJECTION_SIGNATURES, scan_text(), analyze_retrieval(), filter_chunks()
- `backend/src/routers/demo.py` — Attack scenario definitions (SCENARIOS dict) + inject/reset endpoints
- `backend/src/routers/chat.py` — POST /chat with defense pipeline integration
- `backend/src/routers/documents.py` — Upload with Layer 1 scanning + trust score assignment
- `backend/src/utils/vector_store.py` — ChromaDB singleton + in-memory trust registry (set/get/clear_trust_score)
- `backend/src/config.py` — Settings incl. `anomaly_threshold` (1.5) and `trust_threshold` (0.5)
- `frontend/src/app.jsx` — Monolithic React component with defense toggle, ThreatReport display, scenario injection panel
- `demo/legitimate/` — Clean knowledge base documents for the demo
- `demo/poison/` — Attack payload documents (educational, clearly labeled)

## Defense Layers

1. **Input Filtering (upload time)** — `scan_text()` in `defense.py` checks 18 regex patterns against uploaded document text. Flagged docs get `trust_score = 0.3`.
2. **Source Trust Validation (query time)** — `_trust_registry` dict in `vector_store.py`. Retrieved chunks from low-trust sources are excluded by `analyze_retrieval()`.
3. **Semantic Anomaly Detection (query time)** — Chunks with retrieval distance > `mean_distance × anomaly_threshold` are flagged as statistically anomalous.
4. **LLM-as-Judge (pre-retrieval)** — `judge_query()` in `defense.py` sends the user's query to the LLM with `JUDGE_SYSTEM_PROMPT`. Runs *before* retrieval. If `is_injection=True` and `confidence >= JUDGE_BLOCK_THRESHOLD (0.7)`, request is blocked immediately and `ThreatReport` is returned. Result is a `JudgeReport` stored in `ThreatReport.query_judge`.

## Running the Application

### Docker Compose

```bash
cp backend/.env.example backend/.env  # set LLM_API_KEY
docker compose -f docker-compose.prod.yml up --build
```

Frontend: `http://localhost:3000` | Backend: `http://localhost:8000` | API docs: `http://localhost:8000/docs`

### Local Development

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

## Environment Variables

```
LLM_PROVIDER=anthropic    # anthropic | openai | google
LLM_API_KEY=your-key
LLM_MODEL=claude-sonnet-4-20250514
ANOMALY_THRESHOLD=1.5     # optional tuning
TRUST_THRESHOLD=0.5       # optional tuning
```

## Design Decisions

- **Frontend is intentionally a single component** (`app.jsx`) — no routing, no state library, no CSS framework.
- **Trust registry is in-memory** — resets on server restart. Acceptable for a demo; production would persist alongside ChromaDB.
- **Poison docs are still stored even when flagged** — this is intentional so you can observe the attack working (defense off) vs. blocked (defense on).
- **`POST /demo/inject` bypasses upload scanning** — simulates a DB-level compromise where the attacker has direct write access, bypassing Layer 1. Only Layers 1 (pattern scan on retrieval) and 3 (anomaly) can catch it.
- **ChromaDB uses local embeddings** — no external embedding API needed.
