-- Electronic Signatures table for UK construction document signing
CREATE TABLE IF NOT EXISTS signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL, -- 'rams', 'valuation', 'change_order', 'certificate', 'contract', 'transmittal'
    document_id UUID NOT NULL,
    signer_name TEXT NOT NULL,
    signer_role TEXT,
    signer_email TEXT,
    signature_data TEXT NOT NULL, -- Base64 PNG data URL
    ip_address INET,
    user_agent TEXT,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signatures_org ON signatures(organization_id);
CREATE INDEX IF NOT EXISTS idx_signatures_doc ON signatures(document_type, document_id);

COMMENT ON TABLE signatures IS 'Electronic signatures for UK construction documents (eIDAS compliant)';
