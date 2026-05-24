-- Migration 028: BIM Processing Queue
-- Purpose: Track background processing jobs for BIM models

CREATE TABLE IF NOT EXISTS bim_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES bim_models(id) ON DELETE CASCADE,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(model_id)
);

CREATE INDEX IF NOT EXISTS idx_bim_queue_status ON bim_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_bim_queue_created ON bim_processing_queue(created_at DESC);

-- Add cleanup job for old completed/failed entries (optional maintenance)
-- Run periodically: DELETE FROM bim_processing_queue WHERE completed_at < NOW() - INTERVAL '30 days'
