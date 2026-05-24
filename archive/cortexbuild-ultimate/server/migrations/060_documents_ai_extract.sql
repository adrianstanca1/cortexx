-- Cached document text for RAG + AI analysis (optional; analysis still works without DB cache)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_extracted_snippet TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_analysis_cache JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_analysis_at TIMESTAMPTZ;

COMMENT ON COLUMN documents.ai_extracted_snippet IS 'Truncated plain text from PDF/txt for search + LLM context';
COMMENT ON COLUMN documents.ai_analysis_cache IS 'Last structured AI document analysis (summary, risks, actions)';
