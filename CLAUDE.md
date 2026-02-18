# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chat With Docs is a full-stack RAG (Retrieval-Augmented Generation) application. Users upload documents (PDF, TXT, MD), which are chunked and stored in a ChromaDB vector database. They can then ask natural language questions and receive AI-generated answers grounded in the uploaded content with source citations.

## Architecture

```
Frontend (React + Vite)          Backend (FastAPI)              Storage
───────────────────────          ─────────────────              ───────
Nginx serves static +    →      POST /upload (ingest)    →     ChromaDB
proxies /api to backend         POST /chat (RAG query)         (persistent, local SQLite)
Port 3000                       GET /documents (list)          ./chroma_db volume
                                DELETE /documents/{name}
                                Port 8000
```

- **Embeddings** are local via ChromaDB's DefaultEmbeddingFunction (sentence-transformer, no external API).
- **LLM calls** go through `backend/src/utils/call_llm.py` which supports Anthropic, OpenAI, and Google Gemini — selected via `LLM_PROVIDER` env var.
- **RAG pipeline**: fixed-size chunking (800 chars, 100 overlap) → cosine similarity retrieval (top 5) → LLM generation with source citations.

## Running the Application

### Docker Compose (production)

```bash
cp .env.example .env  # fill in LLM_API_KEY
docker compose -f docker-compose.prod.yml up --build
```

Frontend: `http://localhost:3000` | Backend: `http://localhost:8000` | API docs: `http://localhost:8000/docs`

### Local Development

Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm install
npm run dev  # Vite dev server on 3000, proxies /api to localhost:8000
```

## Key Files

- `backend/src/main.py` — FastAPI app, mounts routers, CORS config
- `backend/src/routers/chat.py` — POST /chat, builds RAG prompt from retrieved chunks
- `backend/src/routers/documents.py` — Upload/list/delete documents
- `backend/src/utils/vector_store.py` — ChromaDB singleton, chunking logic, retrieval (CHUNK_SIZE=800, CHUNK_OVERLAP=100, TOP_K=5)
- `backend/src/utils/call_llm.py` — Multi-provider LLM abstraction (anthropic/openai/google)
- `backend/src/config.py` — Pydantic Settings, reads from `.env`
- `frontend/src/app.jsx` — Monolithic React component (~360 lines), all UI state and logic
- `frontend/nginx.conf` — SPA routing + /api proxy to backend
- `frontend/vite.config.js` — Dev proxy config for /api

## Environment Variables

Set in `backend/.env` (local dev) or root `.env` (Docker Compose):

```
LLM_PROVIDER=anthropic    # anthropic | openai | google
LLM_API_KEY=your-key
LLM_MODEL=claude-sonnet-4-20250514
```

## Design Decisions

- **Frontend is intentionally a single component** (`app.jsx`) with local useState — no routing, no state management library, no CSS framework.
- **Vector store is a module-level singleton** — created at import in `vector_store.py`, shared across routers.
- **ChromaDB uses local embeddings** — no external embedding API calls needed.
- **Nginx in frontend container** handles both static file serving and reverse proxying `/api` to the backend.
