"""
Chat router — POST /chat

Runs the full RAG pipeline with an optional four-layer defense:

  Normal mode (defense_mode=False):
    1. Retrieve the top-K most relevant chunks from ChromaDB
    2. Build context string from those chunks
    3. Call the configured LLM
    4. Return the answer with source citations

  Defense mode (defense_mode=True):
    0. Layer 4 — LLM-as-Judge classifies the query BEFORE retrieval.
                 If the query itself is adversarial, short-circuit and block.
    1. Retrieve chunks + distances
    2. Layers 1-3 — scan chunks for injection patterns (L1), exclude low-trust
                    sources (L2), flag semantically anomalous chunks (L3)
    3. Filter out all flagged chunks
    4. If safe chunks remain, call LLM with clean context
    5. Return answer + full ThreatReport (all four layers)
"""

from fastapi import APIRouter, HTTPException

from src.config import settings
from src.models.chat import ChatRequest, ChatResponse
from src.utils.call_llm import call_llm
from src.utils.defense import (
    ThreatReport,
    analyze_retrieval,
    filter_chunks,
    judge_query,
)
from src.utils.vector_store import retrieve_chunks

router = APIRouter(tags=["Chat"])

# ── Prompts ───────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a precise document assistant.
Answer the user's question using ONLY the document excerpts provided in the context block.
- If the answer is present, give a clear and concise response and note which source(s) it came from.
- If the answer is not found in the context, say so explicitly — do not speculate or use outside knowledge.
- Do not reproduce large blocks of source text verbatim; summarise and cite instead."""

USER_PROMPT_TEMPLATE = """<context>
{context}
</context>

Question: {question}"""


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Ask a question about your documents",
)
async def chat(req: ChatRequest) -> ChatResponse:
    """Retrieve relevant document chunks and generate a grounded answer.

    With ``defense_mode=True``, the four-layer pipeline runs:
      Layer 4 runs first on the query itself (pre-retrieval).
      Layers 1-3 run on the retrieved chunks (post-retrieval).
    The ThreatReport in the response covers all layers.
    """

    # ── Layer 4: LLM-as-Judge (pre-retrieval, defense mode only) ──────────────
    if req.defense_mode:
        judge = await judge_query(req.question)

        if judge.blocked:
            return ChatResponse(
                answer=(
                    f"[DEFENSE LAYER 4 — QUERY BLOCKED]\n\n"
                    f"The LLM Judge classified this query as a prompt injection attempt "
                    f"and blocked it before any documents were retrieved.\n\n"
                    f"Attack type: {judge.attack_type or 'unknown'}\n"
                    f"Confidence: {judge.confidence:.0%}\n"
                    f"Reasoning: {judge.reasoning}"
                ),
                sources=[],
                chunks_used=0,
                threat_report=ThreatReport(
                    flagged=True,
                    query_judge=judge,
                    summary=(
                        f"THREAT DETECTED — Layer 4 query injection "
                        f"[{judge.attack_type or 'unknown'}, {judge.confidence:.0%} confidence]"
                    ),
                ),
            )
    else:
        judge = None

    # ── Retrieval ─────────────────────────────────────────────────────────────
    chunks, metas, distances = retrieve_chunks(req.question)

    if not chunks:
        raise HTTPException(
            status_code=422,
            detail="No documents have been ingested yet. Upload files via POST /upload first.",
        )

    threat_report: ThreatReport | None = None

    # ── Layers 1-3: chunk-level analysis (defense mode only) ──────────────────
    if req.defense_mode:
        threat_report = analyze_retrieval(
            chunks=chunks,
            metas=metas,
            distances=distances,
            anomaly_threshold=settings.anomaly_threshold,
            trust_threshold=settings.trust_threshold,
            judge=judge,
        )

        if threat_report.flagged:
            chunks, metas, distances = filter_chunks(chunks, metas, distances, threat_report)

        if not chunks:
            return ChatResponse(
                answer=(
                    "[DEFENSE ACTIVATED] All retrieved context was flagged as potentially "
                    "malicious and has been excluded from the LLM context. "
                    "Cannot generate an answer from untrusted sources. "
                    "Remove the poisoned document or disable defense mode to see the attack."
                ),
                sources=[],
                chunks_used=0,
                threat_report=threat_report,
            )

    # ── Build context and generate answer ─────────────────────────────────────
    context_parts = [
        f"[Source: {m['source']} | chunk {m['chunk_index']}]\n{chunk}"
        for chunk, m in zip(chunks, metas)
    ]
    context = "\n\n---\n\n".join(context_parts)
    sources = list(dict.fromkeys(m["source"] for m in metas))

    user_prompt = USER_PROMPT_TEMPLATE.format(context=context, question=req.question)
    answer = await call_llm(system_prompt=SYSTEM_PROMPT, user_prompt=user_prompt)

    return ChatResponse(
        answer=answer,
        sources=sources,
        chunks_used=len(chunks),
        threat_report=threat_report,
    )
