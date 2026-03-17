"""
RAG Poisoning Demo — Backend entry point.

Starts the FastAPI application, registers all routers, and exposes
a root health-check endpoint.

Run locally:
    uvicorn src.main:app --reload --port 8000

Via Docker:
    CMD in Dockerfile calls `uvicorn src.main:app --host 0.0.0.0 --port 8000`
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.routers import chat, documents
from src.routers import demo

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=(
        "RAG Poisoning Demo — controlled environment for demonstrating and mitigating "
        "prompt injection attacks against Retrieval-Augmented Generation pipelines. "
        "Three defense layers: input filtering, source trust validation, semantic anomaly detection."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(demo.router)

# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Meta"], summary="Health check")
def health() -> dict:
    """Used by Docker Compose's healthcheck and load balancers."""
    return {
        "status": "ok",
        "provider": settings.llm_provider,
        "model": settings.llm_model,
        "anomaly_threshold": settings.anomaly_threshold,
        "trust_threshold": settings.trust_threshold,
    }
