"""
RAG Chat — Backend entry point.

Starts the FastAPI application, registers all routers, and exposes
a root health-check endpoint.

Run locally:
    uvicorn main:app --reload --port 8000

Via Docker:
    CMD in Dockerfile calls `uvicorn main:app --host 0.0.0.0 --port 8000`
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.routers import chat, documents

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=(
        "RAG-powered document assistant API. "
        "Upload documents, then ask questions — answers are grounded in your content."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(documents.router)
app.include_router(chat.router)

# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Meta"], summary="Health check")
def health() -> dict:
    """Used by Docker Compose's healthcheck and load balancers."""
    return {
        "status": "ok",
        "provider": settings.llm_provider,
        "model": settings.llm_model,
    }