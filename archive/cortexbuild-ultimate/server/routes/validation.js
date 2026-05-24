/**
 * Required field validation for generic CRUD router
 * Defines required fields per table for POST operations
 */

const REQUIRED_FIELDS = {
  projects:         ['name', 'client'],
  invoices:         ['number', 'client', 'amount'],
  safety_incidents: ['type', 'title', 'severity', 'project_id'],
  rfis:             ['number', 'subject', 'question', 'project_id'],
  change_orders:    ['number', 'title', 'project_id'],
  team_members:     ['name', 'email'],
  equipment:        ['name', 'type'],
  subcontractors:   ['company', 'trade'],
  documents:        ['name', 'project_id'],
  timesheets:       ['worker_id', 'project_id', 'week'],
  meetings:         ['title', 'project_id', 'date'],
  materials:        ['name', 'category', 'project_id'],
  punch_list:       ['project_id', 'location', 'description'],
  inspections:      ['type', 'project_id', 'date'],
  rams:             ['title', 'project_id', 'activity'],
  cis_returns:      ['contractor', 'utr', 'period'],
  tenders:          ['title', 'client', 'value'],
  contacts:         ['name', 'email'],
  risk_register:    ['title', 'project_id'],
  purchase_orders:  ['number', 'supplier', 'project_id', 'amount'],
  daily_reports:    ['project_id', 'report_date'],
  variations:       ['ref', 'title', 'project_id'],
  defects:          ['reference', 'title', 'project_id', 'location'],
  valuations:       ['reference', 'project_id'],
  specifications:   ['reference', 'title', 'project_id'],
  temp_works:       ['reference', 'title', 'project_id'],
  signage:          ['reference', 'project_id', 'type'],
  waste_management: ['reference', 'project_id', 'waste_type'],
  sustainability:  ['project_id', 'metric_type', 'target'],
  training:         ['reference', 'title', 'project_id'],
  certifications:  ['reference', 'company', 'certification_type'],
  prequalification: ['reference', 'contractor', 'project_id'],
  lettings:        ['reference', 'project_id', 'package_name'],
  measuring:       ['reference', 'project_id', 'survey_type'],
  site_permits:    ['type', 'site'],
  equipment_service_logs: ['equipment_id', 'date', 'type'],
  equipment_hire_logs:   ['equipment_id', 'start_date', 'end_date'],
  risk_mitigation_actions: ['risk_id', 'title', 'due_date'],
  contact_interactions:   ['contact_id', 'type', 'date'],
  safety_permits:        ['permit_no', 'type', 'project', 'start_date'],
  toolbox_talks:         ['date', 'topic'],
  drawing_transmittals:  ['project', 'issued_to', 'date'],
};

/**
 * Validate required fields for a table
 * @param {string} tableName 
 * @param {object} data 
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateRequiredFields(tableName, data) {
  const required = REQUIRED_FIELDS[tableName];
  if (!required) {
    // No validation defined for this table
    return { valid: true, missing: [] };
  }

  const missing = required.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

module.exports = { validateRequiredFields, REQUIRED_FIELDS };
