-- pgvector extension (built-in on Cloud SQL Postgres 14+)
CREATE EXTENSION IF NOT EXISTS vector;

-- Core chunks table
CREATE TABLE IF NOT EXISTS doc_chunks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    content     TEXT        NOT NULL,
    embedding   vector(768) NOT NULL,
    source      TEXT        NOT NULL,
    metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IVFFlat index for approximate cosine-similarity search.
-- lists = 100 suits up to ~1M rows; rebuild with higher lists if you scale.
-- Run VACUUM ANALYZE doc_chunks after bulk ingestion to improve recall.
CREATE INDEX IF NOT EXISTS doc_chunks_embedding_cosine_idx
    ON doc_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS doc_chunks_source_idx
    ON doc_chunks (source);

CREATE INDEX IF NOT EXISTS doc_chunks_created_at_idx
    ON doc_chunks (created_at DESC);
