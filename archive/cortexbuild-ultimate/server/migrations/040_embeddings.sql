-- Migration: 040_embeddings
-- Document embeddings (idempotent; same schema as 003_embeddings.sql for migration-order safety)

CREATE TABLE IF NOT EXISTS document_embeddings (
  id SERIAL PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id ON document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_created_at ON document_embeddings(created_at);

COMMENT ON TABLE document_embeddings IS 'Stores vector embeddings for document chunks enabling semantic search via Ollama';
