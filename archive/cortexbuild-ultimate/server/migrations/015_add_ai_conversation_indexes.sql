-- Migration: 015_add_ai_conversation_indexes
-- Add missing indexes to ai_conversations for better performance

CREATE INDEX IF NOT EXISTS idx_ai_conv_user_id
  ON ai_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_conv_created_at
  ON ai_conversations(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_conv_org_session
  ON ai_conversations(organization_id, session_id, created_at);
