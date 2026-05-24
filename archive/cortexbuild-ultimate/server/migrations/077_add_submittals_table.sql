-- 077_add_submittals_table.sql
-- Submittal register for construction project control.
-- Mixed FK types: drawing_transmittals uses integer PK, specs/rfis/projects/users use uuid.

CREATE TABLE IF NOT EXISTS submittals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number      VARCHAR(100) NOT NULL,
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  type        VARCHAR(100) NOT NULL DEFAULT 'General',
  status      VARCHAR(50) NOT NULL DEFAULT 'Open',
  ball_in_court VARCHAR(100),
  responsible_company VARCHAR(200),
  responsible_person  VARCHAR(200),
  due_date          DATE,
  submitted_date    DATE,
  approved_date     DATE,
  reviewer          VARCHAR(200),
  linked_drawing_id INTEGER REFERENCES drawing_transmittals(id) ON DELETE SET NULL,
  linked_spec_id    UUID    REFERENCES specifications(id)    ON DELETE SET NULL,
  linked_rfi_id     UUID    REFERENCES rfis(id)              ON DELETE SET NULL,
  attachments       JSONB DEFAULT '[]'::jsonb,
  comments          JSONB DEFAULT '[]'::jsonb,
  distribution_list JSONB DEFAULT '[]'::jsonb,
  official_response TEXT,
  created_by        UUID REFERENCES users(id),
  updated_by        UUID REFERENCES users(id),
  organization_id   UUID,
  company_id        UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT submittals_status_check CHECK (
    status IN ('Open','Submitted','In Review','Revision Required','Approved','Rejected','Closed')
  )
);

CREATE INDEX IF NOT EXISTS idx_submittals_project ON submittals(project_id);
CREATE INDEX IF NOT EXISTS idx_submittals_status  ON submittals(status);
CREATE INDEX IF NOT EXISTS idx_submittals_ball    ON submittals(ball_in_court);
CREATE INDEX IF NOT EXISTS idx_submittals_due     ON submittals(due_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_submittals_number_project
  ON submittals (project_id, number);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_submittals_updated_at ON submittals;
CREATE TRIGGER tr_submittals_updated_at
  BEFORE UPDATE ON submittals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE submittals IS 'Construction submittal register: linked to drawings, specs, RFIs, projects.';
