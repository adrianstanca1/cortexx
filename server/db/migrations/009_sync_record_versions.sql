CREATE TABLE IF NOT EXISTS sync_record_versions (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collection   TEXT NOT NULL,
  doc_id       TEXT NOT NULL,
  version      BIGINT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, collection, doc_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_record_versions_ws
  ON sync_record_versions(workspace_id, collection);
