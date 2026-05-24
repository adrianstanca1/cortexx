-- Migration 085: Add checklist and time tracking columns to tasks table
BEGIN;

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS time_spent DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

COMMENT ON COLUMN tasks.checklist IS 'Array of { item: string, completed: boolean, notes?: string }';
COMMENT ON COLUMN tasks.time_spent IS 'Actual hours logged against the task';
COMMENT ON COLUMN tasks.parent_task_id IS 'For subtask grouping within the tasks table';

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

COMMIT;
