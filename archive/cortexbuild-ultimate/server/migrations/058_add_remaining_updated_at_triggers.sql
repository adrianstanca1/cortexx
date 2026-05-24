-- Migration: 058_add_remaining_updated_at_triggers
-- Purpose: Add BEFORE UPDATE triggers to all remaining tables that have an
--          updated_at column but no trigger. Reuses the set_updated_at()
--          function created in migration 057.
-- Run: After migrations 000-057.

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_app_settings_updated_at ON app_settings;
    CREATE TRIGGER trigger_app_settings_updated_at
        BEFORE UPDATE ON app_settings
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_bim4d_models_updated_at ON bim4d_models;
    CREATE TRIGGER trigger_bim4d_models_updated_at
        BEFORE UPDATE ON bim4d_models
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_bim_clashes_detections_updated_at ON bim_clashes_detections;
    CREATE TRIGGER trigger_bim_clashes_detections_updated_at
        BEFORE UPDATE ON bim_clashes_detections
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_bim_models_updated_at ON bim_models;
    CREATE TRIGGER trigger_bim_models_updated_at
        BEFORE UPDATE ON bim_models
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_budget_items_updated_at ON budget_items;
    CREATE TRIGGER trigger_budget_items_updated_at
        BEFORE UPDATE ON budget_items
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_certifications_updated_at ON certifications;
    CREATE TRIGGER trigger_certifications_updated_at
        BEFORE UPDATE ON certifications
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_chat_channels_updated_at ON chat_channels;
    CREATE TRIGGER trigger_chat_channels_updated_at
        BEFORE UPDATE ON chat_channels
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_chat_messages_updated_at ON chat_messages;
    CREATE TRIGGER trigger_chat_messages_updated_at
        BEFORE UPDATE ON chat_messages
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_cost_codes_updated_at ON cost_codes;
    CREATE TRIGGER trigger_cost_codes_updated_at
        BEFORE UPDATE ON cost_codes
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_custom_roles_updated_at ON custom_roles;
    CREATE TRIGGER trigger_custom_roles_updated_at
        BEFORE UPDATE ON custom_roles
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_defects_updated_at ON defects;
    CREATE TRIGGER trigger_defects_updated_at
        BEFORE UPDATE ON defects
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_drawings_updated_at ON drawings;
    CREATE TRIGGER trigger_drawings_updated_at
        BEFORE UPDATE ON drawings
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_email_preferences_updated_at ON email_preferences;
    CREATE TRIGGER trigger_email_preferences_updated_at
        BEFORE UPDATE ON email_preferences
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_email_preferences_new_updated_at ON email_preferences_new;
    CREATE TRIGGER trigger_email_preferences_new_updated_at
        BEFORE UPDATE ON email_preferences_new
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_email_templates_updated_at ON email_templates;
    CREATE TRIGGER trigger_email_templates_updated_at
        BEFORE UPDATE ON email_templates
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_email_templates_new_updated_at ON email_templates_new;
    CREATE TRIGGER trigger_email_templates_new_updated_at
        BEFORE UPDATE ON email_templates_new
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_invitations_updated_at ON invitations;
    CREATE TRIGGER trigger_invitations_updated_at
        BEFORE UPDATE ON invitations
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_lettings_updated_at ON lettings;
    CREATE TRIGGER trigger_lettings_updated_at
        BEFORE UPDATE ON lettings
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_measuring_updated_at ON measuring;
    CREATE TRIGGER trigger_measuring_updated_at
        BEFORE UPDATE ON measuring
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_notification_settings_updated_at ON notification_settings;
    CREATE TRIGGER trigger_notification_settings_updated_at
        BEFORE UPDATE ON notification_settings
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_organizations_updated_at ON organizations;
    CREATE TRIGGER trigger_organizations_updated_at
        BEFORE UPDATE ON organizations
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_prequalification_updated_at ON prequalification;
    CREATE TRIGGER trigger_prequalification_updated_at
        BEFORE UPDATE ON prequalification
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_progress_claims_updated_at ON progress_claims;
    CREATE TRIGGER trigger_progress_claims_updated_at
        BEFORE UPDATE ON progress_claims
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_project_images_updated_at ON project_images;
    CREATE TRIGGER trigger_project_images_updated_at
        BEFORE UPDATE ON project_images
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_project_tasks_updated_at ON project_tasks;
    CREATE TRIGGER trigger_project_tasks_updated_at
        BEFORE UPDATE ON project_tasks
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_projects_updated_at ON projects;
    CREATE TRIGGER trigger_projects_updated_at
        BEFORE UPDATE ON projects
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_quality_checks_updated_at ON quality_checks;
    CREATE TRIGGER trigger_quality_checks_updated_at
        BEFORE UPDATE ON quality_checks
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_rag_embeddings_updated_at ON rag_embeddings;
    CREATE TRIGGER trigger_rag_embeddings_updated_at
        BEFORE UPDATE ON rag_embeddings
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_report_templates_updated_at ON report_templates;
    CREATE TRIGGER trigger_report_templates_updated_at
        BEFORE UPDATE ON report_templates
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_report_templates_new_updated_at ON report_templates_new;
    CREATE TRIGGER trigger_report_templates_new_updated_at
        BEFORE UPDATE ON report_templates_new
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_signage_updated_at ON signage;
    CREATE TRIGGER trigger_signage_updated_at
        BEFORE UPDATE ON signage
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_site_inspections_updated_at ON site_inspections;
    CREATE TRIGGER trigger_site_inspections_updated_at
        BEFORE UPDATE ON site_inspections
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_specifications_updated_at ON specifications;
    CREATE TRIGGER trigger_specifications_updated_at
        BEFORE UPDATE ON specifications
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_submittal_comments_updated_at ON submittal_comments;
    CREATE TRIGGER trigger_submittal_comments_updated_at
        BEFORE UPDATE ON submittal_comments
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_submittals_updated_at ON submittals;
    CREATE TRIGGER trigger_submittals_updated_at
        BEFORE UPDATE ON submittals
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_sustainability_updated_at ON sustainability;
    CREATE TRIGGER trigger_sustainability_updated_at
        BEFORE UPDATE ON sustainability
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks;
    CREATE TRIGGER trigger_tasks_updated_at
        BEFORE UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_team_member_availability_updated_at ON team_member_availability;
    CREATE TRIGGER trigger_team_member_availability_updated_at
        BEFORE UPDATE ON team_member_availability
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_teams_updated_at ON teams;
    CREATE TRIGGER trigger_teams_updated_at
        BEFORE UPDATE ON teams
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_temp_works_updated_at ON temp_works;
    CREATE TRIGGER trigger_temp_works_updated_at
        BEFORE UPDATE ON temp_works
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_training_updated_at ON training;
    CREATE TRIGGER trigger_training_updated_at
        BEFORE UPDATE ON training
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
    CREATE TRIGGER trigger_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_valuations_updated_at ON valuations;
    CREATE TRIGGER trigger_valuations_updated_at
        BEFORE UPDATE ON valuations
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_variations_updated_at ON variations;
    CREATE TRIGGER trigger_variations_updated_at
        BEFORE UPDATE ON variations
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_waste_management_updated_at ON waste_management;
    CREATE TRIGGER trigger_waste_management_updated_at
        BEFORE UPDATE ON waste_management
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_webhooks_updated_at ON webhooks;
    CREATE TRIGGER trigger_webhooks_updated_at
        BEFORE UPDATE ON webhooks
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_work_packages_updated_at ON work_packages;
    CREATE TRIGGER trigger_work_packages_updated_at
        BEFORE UPDATE ON work_packages
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_workflows_updated_at ON workflows;
    CREATE TRIGGER trigger_workflows_updated_at
        BEFORE UPDATE ON workflows
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;