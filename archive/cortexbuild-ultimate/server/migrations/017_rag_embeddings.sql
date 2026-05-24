-- Migration: 017_rag_embeddings
-- Purpose: Tenant-isolated RAG embedding storage with pg_vector HNSW index
-- Run: psql -d cortexbuild -f server/migrations/017_rag_embeddings.sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_embeddings (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  table_name      TEXT        NOT NULL,
  row_id          UUID        NOT NULL,
  chunk_text      TEXT        NOT NULL,
  embedding       vector(1024) NOT NULL,
  embedding_model TEXT        DEFAULT 'qwen3.5:latest',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, table_name, row_id)
);

-- HNSW index for fast approximate nearest-neighbor search
CREATE INDEX IF NOT EXISTS idx_rag_embeddings_hnsw
  ON rag_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Composite index for tenant isolation + staleness checks
CREATE INDEX IF NOT EXISTS idx_rag_embeddings_org_table
  ON rag_embeddings(organization_id, table_name, updated_at);

-- pg_vector 0.6+ provides vector_cosine_ops; fall back to l2_ops if unavailable
-- CREATE INDEX IF NOT EXISTS idx_rag_embeddings_hnsw_l2
--   ON rag_embeddings USING hnsw (embedding vector_l2_ops)
--   WITH (m = 16, ef_construction = 64);

COMMENT ON TABLE rag_embeddings IS 'Tenant-isolated RAG embeddings for all tables, powered by pg_vector HNSW index';
