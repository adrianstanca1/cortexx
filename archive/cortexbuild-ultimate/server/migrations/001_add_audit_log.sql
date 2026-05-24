-- Migration: Add audit_log table for tracking data changes
-- Run this in your PostgreSQL database

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100),
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    changes JSONB,
    user_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

COMMENT ON TABLE audit_log IS 'Tracks all data changes for compliance and debugging';
