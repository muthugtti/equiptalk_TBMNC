#!/usr/bin/env python3
"""
Ingest a PDF into Cloud SQL + pgvector via Vertex AI embeddings.

Usage:
    python ingest.py <path/to/file.pdf> <source_name>
"""
import sys
import os
import json
import math
from pathlib import Path

import fitz  # PyMuPDF
import psycopg2
from psycopg2.extras import execute_values
import tiktoken
from dotenv import load_dotenv
import vertexai
from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel
from google.cloud.sql.connector import Connector

load_dotenv()

PROJECT_ID          = os.environ["PROJECT_ID"]
REGION              = os.environ["REGION"]
CLOUD_SQL_INSTANCE  = os.environ["CLOUD_SQL_INSTANCE"]
DB_NAME             = os.environ["DB_NAME"]
DB_USER             = os.environ["DB_USER"]
DB_PASSWORD         = os.environ["DB_PASSWORD"]

CHUNK_TOKENS    = 500
OVERLAP_TOKENS  = 50
EMBED_BATCH     = 250
EMBED_MODEL     = "text-embedding-004"


# ---------- text utilities ----------

def extract_text(pdf_path: str) -> str:
    doc = fitz.open(pdf_path)
    pages = [page.get_text("text") for page in doc]
    doc.close()
    return "\n".join(pages)


def chunk_text(text: str) -> list[str]:
    enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(text)
    chunks: list[str] = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_TOKENS, len(tokens))
        decoded = enc.decode(tokens[start:end]).strip()
        if decoded:
            chunks.append(decoded)
        if end == len(tokens):
            break
        start += CHUNK_TOKENS - OVERLAP_TOKENS
    return chunks


# ---------- embedding ----------

def embed_all(model: TextEmbeddingModel, chunks: list[str]) -> list[list[float]]:
    embeddings: list[list[float]] = []
    n = math.ceil(len(chunks) / EMBED_BATCH)
    for i in range(n):
        batch = chunks[i * EMBED_BATCH : (i + 1) * EMBED_BATCH]
        print(f"  embedding batch {i + 1}/{n}  ({len(batch)} chunks)")
        inputs = [TextEmbeddingInput(t, "RETRIEVAL_DOCUMENT") for t in batch]
        embeddings.extend(e.values for e in model.get_embeddings(inputs))
    return embeddings


# ---------- DB ----------

_connector: Connector | None = None


def get_connection():
    global _connector
    if _connector is None:
        _connector = Connector()
    return _connector.connect(
        CLOUD_SQL_INSTANCE,
        "psycopg2",
        user=DB_USER,
        password=DB_PASSWORD,
        db=DB_NAME,
    )


def vec_literal(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


def insert_chunks(
    chunks: list[str],
    embeddings: list[list[float]],
    source: str,
    pdf_name: str,
) -> None:
    rows = [
        (
            chunk,
            vec_literal(emb),
            source,
            json.dumps({"chunk_index": idx, "pdf": pdf_name}),
        )
        for idx, (chunk, emb) in enumerate(zip(chunks, embeddings))
    ]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO doc_chunks (content, embedding, source, metadata)
                VALUES %s
                """,
                rows,
                template="(%s, %s::vector, %s, %s::jsonb)",
                page_size=500,
            )
        conn.commit()
    finally:
        conn.close()


# ---------- entry point ----------

def ingest(pdf_path: str, source: str) -> None:
    print(f"Extracting text from {pdf_path} ...")
    text = extract_text(pdf_path)

    print("Chunking ...")
    chunks = chunk_text(text)
    print(f"  {len(chunks)} chunks produced")

    print("Initialising Vertex AI ...")
    vertexai.init(project=PROJECT_ID, location=REGION)
    model = TextEmbeddingModel.from_pretrained(EMBED_MODEL)

    print("Embedding ...")
    embeddings = embed_all(model, chunks)

    print("Writing to Cloud SQL ...")
    insert_chunks(chunks, embeddings, source, Path(pdf_path).name)
    print(f"Inserted {len(chunks)} chunks  (source='{source}')")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python ingest.py <path/to/file.pdf> <source_name>")
    ingest(sys.argv[1], sys.argv[2])
