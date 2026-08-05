"""
Equiptalk RAG API
"""
from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from typing import Optional

import psycopg2
import vertexai
from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from google.cloud.sql.connector import Connector
from pydantic import BaseModel
from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel

load_dotenv()

PROJECT_ID          = os.environ["PROJECT_ID"]
REGION              = os.environ["REGION"]
CLOUD_SQL_INSTANCE  = os.environ["CLOUD_SQL_INSTANCE"]
DB_NAME             = os.environ["DB_NAME"]
DB_USER             = os.environ["DB_USER"]
DB_PASSWORD         = os.environ["DB_PASSWORD"]
ANTHROPIC_API_KEY   = os.environ["ANTHROPIC_API_KEY"]

EMBED_MODEL  = "text-embedding-004"
CLAUDE_MODEL = "claude-sonnet-4-6"
TOP_K        = 5

SYSTEM_PROMPT = """\
You are an AI copilot for manufacturing floor operators.
Answer questions using ONLY the context excerpts provided below from equipment manuals, SOPs, and technical documents.

Rules:
- Give clear, actionable answers an operator can act on immediately.
- If the context does not contain enough information, say so explicitly — do not guess.
- For safety-critical steps, always highlight precautions.
- Use numbered steps for procedures and bullet points for lists.
- Keep answers concise; operators are on the floor, not at a desk.\
"""


# ---------- singletons ----------

class _State:
    connector: Connector | None = None
    embed_model: TextEmbeddingModel | None = None
    anthropic: Anthropic | None = None


_s = _State()


@asynccontextmanager
async def lifespan(app: FastAPI):
    vertexai.init(project=PROJECT_ID, location=REGION)
    _s.connector   = Connector()
    _s.embed_model = TextEmbeddingModel.from_pretrained(EMBED_MODEL)
    _s.anthropic   = Anthropic(api_key=ANTHROPIC_API_KEY)
    yield
    _s.connector.close()


app = FastAPI(title="Equiptalk RAG API", version="1.0.0", lifespan=lifespan)


# ---------- helpers ----------

def get_db() -> psycopg2.extensions.connection:
    return _s.connector.connect(
        CLOUD_SQL_INSTANCE,
        "psycopg2",
        user=DB_USER,
        password=DB_PASSWORD,
        db=DB_NAME,
    )


def embed_query(text: str) -> list[float]:
    inp = TextEmbeddingInput(text, "RETRIEVAL_QUERY")
    return _s.embed_model.get_embeddings([inp])[0].values


def vec_literal(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


# ---------- schemas ----------

class AskRequest(BaseModel):
    question: str
    source_filter: Optional[str] = None


class ChunkResult(BaseModel):
    content: str
    source: str
    metadata: dict
    similarity: float


class AskResponse(BaseModel):
    answer: str
    sources: list[ChunkResult]


# ---------- routes ----------

@app.get("/health")
def health():
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM doc_chunks")
            (count,) = cur.fetchone()
        conn.close()
        return {"status": "ok", "doc_chunks": count}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")

    # 1. Embed query
    query_vec = vec_literal(embed_query(req.question))

    # 2. Retrieve top-K via cosine similarity
    conn = get_db()
    try:
        with conn.cursor() as cur:
            if req.source_filter:
                cur.execute(
                    """
                    SELECT content, source, metadata,
                           1 - (embedding <=> %s::vector) AS similarity
                    FROM   doc_chunks
                    WHERE  source = %s
                    ORDER  BY embedding <=> %s::vector
                    LIMIT  %s
                    """,
                    (query_vec, req.source_filter, query_vec, TOP_K),
                )
            else:
                cur.execute(
                    """
                    SELECT content, source, metadata,
                           1 - (embedding <=> %s::vector) AS similarity
                    FROM   doc_chunks
                    ORDER  BY embedding <=> %s::vector
                    LIMIT  %s
                    """,
                    (query_vec, query_vec, TOP_K),
                )
            rows = cur.fetchall()
    finally:
        conn.close()

    if not rows:
        return AskResponse(
            answer="No relevant documents found. Please ingest relevant manuals or SOPs first.",
            sources=[],
        )

    chunks = [
        ChunkResult(
            content=row[0],
            source=row[1],
            metadata=row[2] if isinstance(row[2], dict) else json.loads(row[2] or "{}"),
            similarity=float(row[3]),
        )
        for row in rows
    ]

    # 3. Build grounded context
    context_block = "\n\n---\n\n".join(
        f"[Source: {c.source}  similarity: {c.similarity:.3f}]\n{c.content}"
        for c in chunks
    )

    # 4. Call Claude
    message = _s.anthropic.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Context:\n{context_block}\n\nQuestion: {req.question}",
            }
        ],
    )

    return AskResponse(answer=message.content[0].text, sources=chunks)
