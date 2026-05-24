-- Equipment IoT / Telematics tables
CREATE TABLE IF NOT EXISTS equipment_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID, -- FK to equipment table
    project_id UUID,
    organization_id UUID,
    company_id UUID,
    device_serial TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK (device_type IN ('gps', 'fuel_sensor', 'hourmeter', 'multi_sensor', 'vibration', 'temperature')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    api_key TEXT UNIQUE NOT NULL, -- device-level auth
    installation_date DATE,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_devices_org ON equipment_devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_equipment_devices_equipment ON equipment_devices(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_devices_project ON equipment_devices(project_id);

CREATE TABLE IF NOT EXISTS equipment_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES equipment_devices(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    data JSONB NOT NULL DEFAULT '{}', -- fuel_level, hours, temperature, vibration, etc.
    alert JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_telemetry_device ON equipment_telemetry(device_id);
CREATE INDEX IF NOT EXISTS idx_equipment_telemetry_recorded ON equipment_telemetry(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_telemetry_location ON equipment_telemetry(latitude, longitude) WHERE latitude IS NOT NULL;
