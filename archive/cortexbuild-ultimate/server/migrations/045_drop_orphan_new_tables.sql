-- 045: Drop orphan _new tables
-- These were empty duplicate tables left over from earlier migration rebuilds.
-- All 12 had 0 rows; the real tables (without _new suffix) contain the actual data.
-- Dropped 2026-04-06

DROP TABLE IF EXISTS ai_vision_logs_new CASCADE;
DROP TABLE IF EXISTS contact_interactions_new CASCADE;
DROP TABLE IF EXISTS lettings_new CASCADE;
DROP TABLE IF EXISTS measuring_new CASCADE;
DROP TABLE IF EXISTS project_tasks_new CASCADE;
DROP TABLE IF EXISTS risk_mitigation_actions_new CASCADE;
DROP TABLE IF EXISTS signage_new CASCADE;
DROP TABLE IF EXISTS sustainability_new CASCADE;
DROP TABLE IF EXISTS temp_works_new CASCADE;
DROP TABLE IF EXISTS training_new CASCADE;
DROP TABLE IF EXISTS waste_management_new CASCADE;
DROP TABLE IF EXISTS work_packages_new CASCADE;
