# RAG Chat — Project Documentation

A complete **Retrieval-Augmented Generation (RAG)** example application. Upload documents, ask questions, and get answers grounded in your own content — with source citations showing exactly which file each answer came from.

---

## What is RAG?

RAG combines a **retrieval** step with a **generation** step:

```
Traditional LLM:  Question ──────────────────────────→ LLM → Answer (from training data only)

RAG:              Question → Search your docs → Context
                                                   ↓
                             Question + Context → LLM → Grounded Answer + Sources
```

This means the model isn't guessing from general knowledge — it's reading your documents and answering based on what's actually in them.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  React SPA  ←→  /api/*  ←→  Nginx                     │
└─────────────────────┬───────────────────────────────────┘
                      │ proxy
┌─────────────────────▼───────────────────────────────────┐
│  Backend (FastAPI)                                      │
│                                                         │
│  POST /upload  → chunk → embed → ChromaDB              │
│  POST /chat    → embed query → retrieve → Claude API   │
│  GET  /documents                                        │
│  DEL  /documents/:name                                  │
└─────────────────────────────────────────────────────────┘
```

**Services:**
- `frontend` — React app, served by Nginx on port `3000`, proxies `/api` to backend
- `backend` — FastAPI on port `8000`, persists ChromaDB to a Docker volume

---

## Project Structure

```
rag-chat/
├── docker-compose.yml       Orchestrates both services
├── .env.example             Copy to .env and add your API key
├── .gitignore
├── docs/
│   └── README.md            ← You are here
│
├── frontend/
│   ├── Dockerfile           Multi-stage Node build → Nginx
│   ├── nginx.conf           SPA routing + /api proxy
│   ├── package.json
│   ├── vite.config.js       Dev proxy config
│   ├── index.html
│   ├── docs/
│   │   └── README.md        Frontend technical docs
│   └── src/
│       ├── main.jsx
│       └── App.jsx          Full chat UI
│
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    ├── main.py              RAG pipeline + FastAPI routes
    └── docs/
        └── README.md        Backend technical docs
```

---

## Quickstart

### Prerequisites
- Docker Desktop (or Docker Engine + Compose plugin)
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Start everything

```bash
docker compose up --build
```

This will:
1. Build the Python backend image
2. Build the React frontend and bundle it into an Nginx image
3. Start both containers. The frontend waits for the backend healthcheck to pass before coming up

### 3. Open the app

```
http://localhost:3000
```

Drag and drop PDFs, TXT, or Markdown files into the sidebar, then ask questions in the chat.

---

## Common Commands

```bash
# Start (detached)
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down

# Stop AND delete all stored document data
docker compose down -v

# Rebuild a single service after code changes
docker compose up --build backend
docker compose up --build frontend
```

---

## Local Development (without Docker)

See the individual service docs for running each piece locally:

- [`frontend/docs/README.md`](../frontend/docs/README.md)
- [`backend/docs/README.md`](../backend/docs/README.md)

---

## Further Reading

- [Anthropic API Documentation](https://docs.anthropic.com)
- [ChromaDB Documentation](https://docs.trychroma.com)
- [FastAPI Documentation](https://fastapi.tiangolo.com)