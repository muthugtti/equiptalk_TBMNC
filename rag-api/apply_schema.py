"""Run once to apply schema.sql to Cloud SQL."""
import os
from dotenv import load_dotenv
from google.cloud.sql.connector import Connector

load_dotenv()

sql = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS doc_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    source TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doc_chunks_embedding_cosine_idx
    ON doc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS doc_chunks_source_idx ON doc_chunks (source);
CREATE INDEX IF NOT EXISTS doc_chunks_created_at_idx ON doc_chunks (created_at DESC);
"""

connector = Connector()
conn = connector.connect(
    os.environ["CLOUD_SQL_INSTANCE"],
    "psycopg2",
    user=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    db=os.environ["DB_NAME"],
)
with conn.cursor() as cur:
    cur.execute(sql)
conn.commit()
conn.close()
connector.close()
print("Schema applied successfully.")
