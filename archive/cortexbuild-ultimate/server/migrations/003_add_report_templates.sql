-- Migration: Add report_templates table for saved report configurations
-- Run this in your PostgreSQL database

CREATE TABLE IF NOT EXISTS report_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(type);
CREATE INDEX IF NOT EXISTS idx_report_templates_default ON report_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);

-- Insert default templates
INSERT INTO report_templates (name, type, description, config, is_default) VALUES
('Monthly Summary', 'financial-summary', 'Monthly financial overview with key metrics', 
 '{"columns": ["revenue", "costs", "profit", "outstanding"], "filters": {"dateRange": "this_month"}, "groupBy": null, "sortBy": "date", "sortOrder": "desc", "chartType": "bar"}', true),
('Project Costs Detail', 'project-costs', 'Detailed breakdown of costs by project',
 '{"columns": ["name", "budget", "spent", "variance"], "filters": {"status": "active"}, "groupBy": "status", "sortBy": "spent", "sortOrder": "desc"}', true),
('Invoice Status Report', 'invoices', 'Invoice status and aging analysis',
 '{"columns": ["number", "client", "amount", "status", "due_date"], "filters": {"status": ["pending", "sent", "overdue"]}, "groupBy": "status"}', true),
('Weekly Team Report', 'team-hours', 'Team hours and productivity',
 '{"columns": ["name", "hours", "project", "overtime"], "filters": {"week": "current"}, "groupBy": "trade"}', true);
