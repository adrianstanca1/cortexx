-- Migration: Enhanced Projects - Gallery, Tasks, Documents
-- Run: docker exec -i cortexbuild-postgres psql -U cortexbuild -d cortexbuild_db < server/migrations/013_enhanced_projects.sql

BEGIN;

-- ─── Project Images (Gallery) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  file_path   VARCHAR(500) NOT NULL,
  caption     VARCHAR(500) DEFAULT '',
  category    VARCHAR(100) DEFAULT 'general',
  uploaded_by VARCHAR(255) DEFAULT 'Unknown',
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE project_images IS 'Project gallery photos and site images';

-- ─── Project Tasks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  description     TEXT         DEFAULT '',
  status          VARCHAR(50)  DEFAULT 'todo',
  priority        VARCHAR(50)  DEFAULT 'medium',
  assigned_to     VARCHAR(255) DEFAULT NULL,
  due_date        DATE         DEFAULT NULL,
  category        VARCHAR(100) DEFAULT 'general',
  estimated_hours DECIMAL(10,2) DEFAULT NULL,
  progress        INTEGER      DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  tags            TEXT         DEFAULT '',
  created_by      VARCHAR(255) DEFAULT 'Unknown',
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW(),
  completed_at    TIMESTAMPTZ  DEFAULT NULL
);

COMMENT ON TABLE project_tasks IS 'Project-specific tasks and to-do items';

-- Status values: todo, in_progress, review, blocked, done
-- Priority values: low, medium, high, critical

-- ─── Project Task Comments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
  comment    TEXT NOT NULL,
  author     VARCHAR(255) DEFAULT 'Unknown',
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE project_task_comments IS 'Comments on project tasks';

-- ─── Documents table enhancements ─────────────────────────────────────────────
-- Add missing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'discipline') THEN
    ALTER TABLE documents ADD COLUMN discipline VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'access_level') THEN
    ALTER TABLE documents ADD COLUMN access_level VARCHAR(50) DEFAULT 'project';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'date_issued') THEN
    ALTER TABLE documents ADD COLUMN date_issued DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'author') THEN
    ALTER TABLE documents ADD COLUMN author VARCHAR(255);
  END IF;
END $$;

-- ─── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_project_images_project_id  ON project_images(project_id);
CREATE INDEX IF NOT EXISTS idx_project_images_category  ON project_images(category);
CREATE INDEX IF NOT EXISTS idx_project_images_created   ON project_images(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id  ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status      ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_priority    ON project_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to ON project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date    ON project_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_project_tasks_created    ON project_tasks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_task_comments_task_id ON project_task_comments(task_id);

-- ─── Documents: add indexes if missing ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_category    ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_type         ON documents(type);

COMMIT;
