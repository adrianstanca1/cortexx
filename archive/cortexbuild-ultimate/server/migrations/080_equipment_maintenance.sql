-- Migration: Equipment Maintenance Scheduling & History
-- Complete replacement for ad-hoc service logs. Supports recurring maintenance,
-- QR-based check-in/out, service history analytics, and maintenance KPIs.

CREATE TYPE maintenance_status AS ENUM (
  'scheduled', 'overdue', 'in_progress', 'completed', 'cancelled', 'deferred'
);

CREATE TYPE maintenance_priority AS ENUM ('low', 'normal', 'high', 'critical');

CREATE TYPE maintenance_type AS ENUM (
  'routine_service', 'repair', 'inspection', 'loler_examination', 'pssr',
  'overhaul', 'calibration', 'winter_service', 'breakdown', 'pre_hire_check'
);

CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    organization_id UUID,
    company_id UUID,
    title TEXT NOT NULL,
    maintenance_type maintenance_type NOT NULL DEFAULT 'routine_service',
    priority maintenance_priority NOT NULL DEFAULT 'normal',
    status maintenance_status NOT NULL DEFAULT 'scheduled',
    description TEXT,
    scheduled_date DATE NOT NULL,
    due_date DATE,
    completed_date DATE,
    estimated_hours NUMERIC(6,2),
    actual_hours NUMERIC(6,2),
    technician TEXT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    recurring_schedule JSONB, -- { frequency: 'daily'|'weekly'|'monthly'|'quarterly'|'annually', interval: int, end_date?, day_of_week?, week_of_month? }
    parent_schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE CASCADE,
    checklist JSONB DEFAULT '[]', -- [{ item: 'Check oil level', required: true, completed: false, notes: '' }]
    parts_used JSONB DEFAULT '[]', -- [{ material_id, name, quantity, cost }]
    cost_estimate NUMERIC(12,2),
    actual_cost NUMERIC(12,2),
    downtime_hours NUMERIC(6,2),
    notes TEXT,
    qr_code TEXT, -- generated ref
    photos JSONB DEFAULT '[]',
    documents JSONB DEFAULT '[]',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_equipment ON maintenance_schedules(equipment_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_org ON maintenance_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_project ON maintenance_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_status ON maintenance_schedules(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_date ON maintenance_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_due ON maintenance_schedules(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_parent ON maintenance_schedules(parent_schedule_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_composite ON maintenance_schedules(organization_id, status, scheduled_date);

-- Maintenance KPI / dashboard summary table (materialized by trigger or refresh)
CREATE TABLE IF NOT EXISTS maintenance_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    company_id UUID,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type TEXT NOT NULL DEFAULT 'month', -- week, month, quarter, year
    total_scheduled INT NOT NULL DEFAULT 0,
    total_completed INT NOT NULL DEFAULT 0,
    total_overdue INT NOT NULL DEFAULT 0,
    total_downtime_hours NUMERIC(10,2) DEFAULT 0,
    total_cost NUMERIC(14,2) DEFAULT 0,
    compliance_rate NUMERIC(5,2) DEFAULT 0, -- completed / scheduled * 100
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, period_start, period_end, period_type)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_kpis_org ON maintenance_kpis(organization_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_kpis_period ON maintenance_kpis(period_start DESC, period_type);

-- Insert migration log entry
INSERT INTO migration_log (version, description, applied_at)
VALUES (80, 'Add equipment maintenance scheduling and KPI tables', NOW())
ON CONFLICT DO NOTHING;
