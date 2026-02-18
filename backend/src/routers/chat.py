"""
Chat router — POST /chat

Runs the full RAG pipeline:
  1. Embed the user's question
  2. Retrieve the top-K most relevant chunks from ChromaDB
  3. Build a context string from those chunks
  4. Call the configured LLM via call_llm()
  5. Return the answer with source citations
"""

from fastapi import APIRouter, HTTPException

from src.models.chat import ChatRequest, ChatResponse
from src.utils.call_llm import call_llm
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
    """Retrieve relevant document chunks and generate a grounded answer via the LLM."""

    # 1. Retrieve
    chunks, metas = retrieve_chunks(req.question)

    if not chunks:
        raise HTTPException(
            status_code=422,
            detail="No documents have been ingested yet. Upload files via POST /upload first.",
        )

    # 2. Build context — label each chunk with its source for the LLM to cite
    context_parts = [
        f"[Source: {m['source']} | chunk {m['chunk_index']}]\n{chunk}"
        for chunk, m in zip(chunks, metas)
    ]
    context = "\n\n---\n\n".join(context_parts)

    # 3. Deduplicated source list (preserving retrieval order)
    sources = list(dict.fromkeys(m["source"] for m in metas))

    # 4. Call LLM
    user_prompt = USER_PROMPT_TEMPLATE.format(context=context, question=req.question)
    answer = await call_llm(system_prompt=SYSTEM_PROMPT, user_prompt=user_prompt)

    return ChatResponse(
        answer=answer,
        sources=sources,
        chunks_used=len(chunks),
    )