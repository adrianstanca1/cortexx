-- Add GPS coordinates to projects for mobile clock-in radius check
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS latitude  FLOAT,
  ADD COLUMN IF NOT EXISTS longitude FLOAT;

COMMENT ON COLUMN projects.latitude  IS 'Site GPS latitude for field worker clock-in radius check';
COMMENT ON COLUMN projects.longitude IS 'Site GPS longitude for field worker clock-in radius check';
