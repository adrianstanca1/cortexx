-- Migration: Add email_templates table for user-defined email templates
-- Run this in your PostgreSQL database

CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT,
    email_type VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(email_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_creator ON email_templates(created_by);

-- Seed with default system templates
INSERT INTO email_templates (name, subject, body, email_type, description, variables, is_active) VALUES
    ('Contract Award', 'Contract Award Notice — {{project_name}}', 'Dear {{recipient_name}},\n\nPlease find attached the contract award documentation for {{project_name}}.\n\nProject Value: {{project_value}}\nStart Date: {{start_date}}\nDuration: {{duration}}\n\nPlease review and acknowledge receipt.', 'contract_award', 'Sent when a contract is awarded', '["recipient_name", "project_name", "project_value", "start_date", "duration"]', TRUE),
    ('Payment Application', 'Payment Application {{period}}', 'Please see attached payment application for {{project_name}}.\n\nPeriod: {{period}}\nAmount: {{amount}}\nStatus: {{status}}', 'payment_application', 'Monthly payment applications', '["project_name", "period", "amount", "status"]', TRUE),
    ('RFI Acknowledgement', 'RFI {{rfi_number}} — Acknowledged', 'Thank you for your RFI. We acknowledge receipt of RFI {{rfi_number}}.\n\nSubject: {{subject}}\nReceived: {{date}}\nResponse Due: {{response_due}}', 'rfi_acknowledgement', 'Acknowledge RFI receipt', '["rfi_number", "subject", "date", "response_due"]', TRUE),
    ('Defect Notice', 'Defect Notice — {{project_name}}', 'The following defects have been identified and require rectification:\n\nDefect: {{defect_description}}\nLocation: {{location}}\nPriority: {{priority}}\nDue Date: {{due_date}}', 'defect_notice', 'Report defects requiring rectification', '["project_name", "defect_description", "location", "priority", "due_date"]', TRUE),
    ('Meeting Invite', '{{meeting_type}} Meeting — {{date}}', 'You are invited to a meeting:\n\nTitle: {{meeting_title}}\nDate: {{date}}\nTime: {{time}}\nLocation: {{location}}\nAgenda: {{agenda}}', 'meeting_invite', 'Send meeting invitations', '["meeting_title", "meeting_type", "date", "time", "location", "agenda"]', TRUE)
ON CONFLICT DO NOTHING;
