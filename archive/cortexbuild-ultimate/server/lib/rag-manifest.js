/**
 * server/lib/rag-manifest.js
 * Declarative config mapping every table to its textification function + metadata.
 * Used by both the embedding worker (rag-embed.js) and retrieval endpoint (rag.js).
 *
 * textify(row) → string  — what to embed for each row
 * getOrgId(row) → string — how to derive organization_id from a row
 */
const manifest = {
  projects: {
    textify: r => `${r.name || r.title} | Client: ${r.client || 'N/A'} | Status: ${r.status || 'N/A'} | Type: ${r.type || 'N/A'} | Phase: ${r.phase || 'N/A'} | Manager: ${r.manager || 'N/A'} | Location: ${r.location || 'N/A'} | Progress: ${r.progress || 0}% | Budget: ${r.budget || 0} | Spent: ${r.spent || 0} | ${r.description || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  invoices: {
    textify: r => `Invoice #${r.number || ''} | Client: ${r.client || ''} | Project: ${r.project || ''} | Amount: ${r.amount || 0} | VAT: ${r.vat || 0} | Status: ${r.status || ''} | Issue Date: ${r.issue_date || ''} | Due Date: ${r.due_date || ''} | ${r.description || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  safety_incidents: {
    textify: r => `Safety Incident: ${r.title || ''} | Type: ${r.type || ''} | Severity: ${r.severity || ''} | Status: ${r.status || ''} | Project: ${r.project || ''} | Reported by: ${r.reported_by_name || ''} | Date: ${r.date || ''} | Location: ${r.location || ''} | Root Cause: ${r.root_cause || ''} | Corrective Actions: ${r.corrective_actions || ''} | ${r.description || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  rfis: {
    textify: r => `RFI #${r.number || r.rfi_number || ''} | Subject: ${r.subject || ''} | Project: ${r.project || ''} | Status: ${r.status || ''} | Priority: ${r.priority || ''} | Submitted by: ${r.submitted_by || ''} | Due Date: ${r.due_date || ''} | Assigned to: ${r.assigned_to || ''} | Discipline: ${r.discipline || ''} | ${r.question || ''} ${r.response || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  change_orders: {
    textify: r => `Change Order #${r.number || r.co_number || ''} | Title: ${r.title || ''} | Project: ${r.project || ''} | Amount: ${r.amount || r.value || 0} | Status: ${r.status || ''} | Submitted: ${r.submitted_date || ''} | Approved: ${r.approved_date || ''} | Reason: ${r.reason || ''} | ${r.description || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  team_members: {
    textify: r => `${r.name || ''} | Role: ${r.role || ''} | Trade: ${r.trade || ''} | Status: ${r.status || ''} | CIS Status: ${r.cis_status || ''} | Email: ${r.email || ''} | Phone: ${r.phone || ''} | Daily Rate: ${r.daily_rate || ''} | CSCS: ${r.cscs_card || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  documents: {
    textify: r => {
      const base = `Document: ${r.name || ''} | Type: ${r.type || ''} | Category: ${r.category || ''} | Project: ${r.project || ''} | Status: ${r.status || ''} | Uploaded by: ${r.uploaded_by || ''} | Version: ${r.version || ''} | Date Issued: ${r.date_issued || ''} | ${r.description || ''}`;
      const snip = r.ai_extracted_snippet
        ? ` | Text excerpt: ${String(r.ai_extracted_snippet).slice(0, 2500)}`
        : "";
      return base + snip;
    },
    getOrgId: r => r.organization_id || r.company_id,
  },
  timesheets: {
    textify: r => `Timesheet | Worker: ${r.worker || ''} | Project: ${r.project || ''} | Week: ${r.week || ''} | Regular Hours: ${r.regular_hours || 0} | Overtime: ${r.overtime_hours || 0} | Daywork: ${r.daywork_hours || 0} | Total Pay: ${r.total_pay || 0} | Status: ${r.status || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  meetings: {
    textify: r => `Meeting: ${r.title || ''} | Type: ${r.meeting_type || ''} | Project: ${r.project || ''} | Date: ${r.date || ''} | Time: ${r.time || ''} | Location: ${r.location || ''} | Attendees: ${r.attendees || ''} | Agenda: ${r.agenda || ''} | Actions: ${r.actions || ''} | Status: ${r.status || ''} | ${r.minutes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  materials: {
    textify: r => `Material: ${r.name || ''} | Category: ${r.category || ''} | Quantity: ${r.quantity || ''} ${r.unit || ''} | Unit Cost: ${r.unit_cost || 0} | Total Cost: ${r.total_cost || 0} | Supplier: ${r.supplier || ''} | Project: ${r.project || ''} | Status: ${r.status || ''} | Delivery: ${r.delivery_date || ''} | PO#: ${r.po_number || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  punch_list: {
    textify: r => `Punch List Item | Project: ${r.project || ''} | Location: ${r.location || ''} | Description: ${r.description || ''} | Assigned to: ${r.assigned_to || ''} | Priority: ${r.priority || ''} | Status: ${r.status || ''} | Due: ${r.due_date || ''} | Trade: ${r.trade || ''} | Category: ${r.category || ''} | ${r.resolution || ''} ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  inspections: {
    textify: r => `Inspection: ${r.title || ''} | Type: ${r.type || ''} | Project: ${r.project || ''} | Inspector: ${r.inspector || ''} | Date: ${r.date || ''} | Score: ${r.score || ''} | Status: ${r.status || ''} | Next: ${r.next_inspection || ''} | Location: ${r.location || ''} | Findings: ${r.findings || ''} | Corrective Actions: ${r.corrective_actions || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  rams: {
    textify: r => `RAMS: ${r.title || ''} | Project: ${r.project || ''} | Activity: ${r.activity || ''} | Doc Type: ${r.doc_type || ''} | Version: ${r.version || ''} | Status: ${r.status || ''} | Risk Level: ${r.risk_level || ''} | Created by: ${r.created_by || ''} | Approved by: ${r.approved_by || ''} | Review Date: ${r.review_date || ''} | Hazards: ${r.hazards || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  cis_returns: {
    textify: r => `CIS Return | Contractor: ${r.contractor || ''} | UTR: ${r.utr || ''} | Period: ${r.period || ''} | Gross Payment: ${r.gross_payment || 0} | Materials Cost: ${r.materials_cost || 0} | Labour Net: ${r.labour_net || 0} | CIS Deduction: ${r.cis_deduction || 0} | CIS Rate: ${r.cis_rate || ''} | Status: ${r.status || ''} | Verification: ${r.verification_status || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  tenders: {
    textify: r => `Tender: ${r.title || ''} | Client: ${r.client || ''} | Value: ${r.value || 0} | Deadline: ${r.deadline || ''} | Status: ${r.status || ''} | Probability: ${r.probability || ''} | Type: ${r.type || ''} | Location: ${r.location || ''} | Stage: ${r.stage || ''} | Result Date: ${r.result_date || ''} | AI Score: ${r.ai_score || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  contacts: {
    textify: r => `Contact: ${r.name || ''} | Company: ${r.company || ''} | Role: ${r.role || ''} | Email: ${r.email || ''} | Phone: ${r.phone || ''} | Type: ${r.type || ''} | Value: ${r.value || ''} | Last Contact: ${r.last_contact || ''} | Status: ${r.status || ''} | Projects: ${r.projects || ''} | Address: ${r.address || ''} | Website: ${r.website || ''} | Rating: ${r.rating || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  risk_register: {
    textify: r => `Risk: ${r.title || ''} | Project: ${r.project || ''} | Category: ${r.category || ''} | Likelihood: ${r.likelihood || ''} | Impact: ${r.impact || ''} | Risk Score: ${r.risk_score || ''} | Owner: ${r.owner || ''} | Status: ${r.status || ''} | Mitigation: ${r.mitigation || ''} | Contingency: ${r.contingency || ''} | Review: ${r.review_date || ''} | ${r.description || ''} ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  purchase_orders: {
    textify: r => `PO #${r.number || ''} | Supplier: ${r.supplier || ''} | Project: ${r.project || ''} | Amount: ${r.amount || 0} | Status: ${r.status || ''} | Order Date: ${r.order_date || ''} | Delivery Date: ${r.delivery_date || ''} | Category: ${r.category || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  daily_reports: {
    textify: r => `Daily Report | Project: ${r.project || ''} | Date: ${r.report_date || ''} | Prepared by: ${r.prepared_by || ''} | Weather: ${r.weather || ''} | Temp: ${r.temp_high || ''}/${r.temp_low || ''} | Workers: ${r.workers_on_site || 0} | Progress: ${r.progress || ''} | Activities: ${r.activities || ''} | Materials: ${r.materials || ''} | Equipment: ${r.equipment || ''} | Safety: ${r.safety_observations || ''} | ${r.issues || ''} ${r.delays || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  variations: {
    textify: r => `Variation: ${r.ref || ''} | Title: ${r.title || ''} | Project: ${r.project || ''} | Subcontractor: ${r.subcontractor || ''} | Type: ${r.type || ''} | Value: ${r.value || 0} | Original: ${r.original_value || 0} | Status: ${r.status || ''} | Submitted: ${r.submitted_date || ''} | Responded: ${r.responded_date || ''} | Reason: ${r.reason || ''} | ${r.description || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  defects: {
    textify: r => `Defect: ${r.reference || ''} | Title: ${r.title || ''} | Project: ${r.project || ''} | Location: ${r.location || ''} | Description: ${r.description || ''} | Priority: ${r.priority || ''} | Status: ${r.status || ''} | Trade: ${r.trade || ''} | Raised by: ${r.raised_by || ''} | Assigned to: ${r.assigned_to || ''} | Due: ${r.due_date || ''} | Closed: ${r.closed_date || ''} | Cost: ${r.cost || ''} | Category: ${r.category || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  valuations: {
    textify: r => `Valuation: ${r.reference || ''} | Project: ${r.project || ''} | Application #: ${r.application_number || ''} | Period: ${r.period_start || ''} to ${r.period_end || ''} | Status: ${r.status || ''} | Contractor: ${r.contractor_name || ''} | Client: ${r.client_name || ''} | Original: ${r.original_value || 0} | Variations: ${r.variations || 0} | Total: ${r.total_value || 0} | Retention: ${r.retention || 0} | Amount Due: ${r.amount_due || 0} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  specifications: {
    textify: r => `Spec: ${r.reference || ''} | ${r.title || ''} | Project: ${r.project || ''} | Section: ${r.section || ''} | Version: ${r.version || ''} | Status: ${r.status || ''} | Description: ${r.description || ''} | Materials: ${r.materials || ''} | Standards: ${r.standards || ''} | Approved by: ${r.approved_by || ''} | ${r.specifications || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  temp_works: {
    textify: r => `Temp Work: ${r.reference || ''} | ${r.title || ''} | Project: ${r.project || ''} | Type: ${r.type || ''} | Status: ${r.status || ''} | Location: ${r.location || ''} | Description: ${r.description || ''} | Design by: ${r.design_by || ''} | Approved by: ${r.approved_by || ''} | Design Date: ${r.design_date || ''} | Approval Date: ${r.approval_date || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  signage: {
    textify: r => `Signage: ${r.reference || ''} | Project: ${r.project || ''} | Type: ${r.type || ''} | Description: ${r.description || ''} | Location: ${r.location || ''} | Size: ${r.size || ''} | Material: ${r.material || ''} | Quantity: ${r.quantity || ''} | Status: ${r.status || ''} | Required: ${r.required_date || ''} | Installed: ${r.installed_date || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  waste_management: {
    textify: r => `Waste: ${r.reference || ''} | Project: ${r.project || ''} | Type: ${r.waste_type || ''} | Carrier: ${r.carrier || ''} | License: ${r.license_number || ''} | Skip: ${r.skip_number || ''} | Collection: ${r.collection_date || ''} | Qty: ${r.quantity || ''} ${r.unit || ''} | Cost: ${r.cost || ''} | Disposal Site: ${r.disposal_site || ''} | Waste Code: ${r.waste_code || ''} | Status: ${r.status || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  sustainability: {
    textify: r => `Sustainability: ${r.metric_type || ''} | Project: ${r.project || ''} | Target: ${r.target || ''} | Actual: ${r.actual || ''} | Unit: ${r.unit || ''} | Period: ${r.period || ''} | Status: ${r.status || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  training: {
    textify: r => `Training: ${r.title || ''} | Project: ${r.project || ''} | Type: ${r.type || ''} | Provider: ${r.provider || ''} | Duration: ${r.duration || ''} | Cost: ${r.cost || ''} | Attendees: ${r.attendees || ''} | Status: ${r.status || ''} | Scheduled: ${r.scheduled_date || ''} | Completed: ${r.completed_date || ''} | Cert: ${r.certification || ''} | Expiry: ${r.expiry_date || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  certifications: {
    textify: r => `Certification: ${r.reference || ''} | Company: ${r.company || ''} | Type: ${r.certification_type || ''} | Body: ${r.body || ''} | Grade: ${r.grade || ''} | Expiry: ${r.expiry_date || ''} | Status: ${r.status || ''} | Renewal: ${r.renewal_date || ''} | Cost: ${r.cost || ''} | Accreditation: ${r.accreditation_number || ''} | Scope: ${r.scope || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  prequalification: {
    textify: r => `Prequal: ${r.reference || ''} | Contractor: ${r.contractor || ''} | Project: ${r.project || ''} | Questionnaire: ${r.questionnaire_type || ''} | Status: ${r.status || ''} | Score: ${r.score || ''} | Approved by: ${r.approved_by || ''} | Approved Date: ${r.approved_date || ''} | Expiry: ${r.expiry_date || ''} | Sections: ${r.sections_completed || ''}/${r.total_sections || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  lettings: {
    textify: r => `Letting: ${r.reference || ''} | Package: ${r.package_name || ''} | Project: ${r.project || ''} | Trade: ${r.trade || ''} | Status: ${r.status || ''} | Tender Closing: ${r.tender_closing_date || ''} | Award Date: ${r.award_date || ''} | Contractor: ${r.contractor || ''} | Contract Value: ${r.contract_value || 0} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  measuring: {
    textify: r => `Measuring: ${r.reference || ''} | Project: ${r.project || ''} | Survey Type: ${r.survey_type || ''} | Location: ${r.location || ''} | Status: ${r.status || ''} | Surveyor: ${r.surveyor || ''} | Survey Date: ${r.survey_date || ''} | Completed: ${r.completed_date || ''} | Areas: ${r.areas || ''} | Total Area: ${r.total_area || ''} | Unit: ${r.unit || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  subcontractors: {
    textify: r => `Subcontractor: ${r.company || ''} | Trade: ${r.trade || ''} | Contact: ${r.contact || ''} | Email: ${r.email || ''} | Phone: ${r.phone || ''} | Status: ${r.status || ''} | CIS Verified: ${r.cis_verified || ''} | CIS Status: ${r.cis_status || ''} | Insurance Expiry: ${r.insurance_expiry || ''} | RAMS Approved: ${r.rams_approved || ''} | Current Project: ${r.current_project || ''} | Contract Value: ${r.contract_value || 0} | Rating: ${r.rating || ''} | UTR: ${r.utr_number || ''} | Address: ${r.address || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  equipment: {
    textify: r => `Equipment: ${r.name || ''} | Type: ${r.type || ''} | Registration: ${r.registration || ''} | Serial: ${r.serial_number || ''} | Status: ${r.status || ''} | Location: ${r.location || ''} | Next Service: ${r.next_service || ''} | Daily Rate: ${r.daily_rate || ''} | Hire Period: ${r.hire_period || ''} | Category: ${r.category || ''} | Ownership: ${r.ownership || ''} | Inspection Due: ${r.inspection_due || ''} | MEWP Check: ${r.mewp_check || ''} | Project: ${r.project_id || ''} | Supplier: ${r.supplier || ''} | ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  // Junction / child tables — embed parent context too
  site_permits: {
    textify: r => `Site Permit: ${r.type || ''} | Site: ${r.site || ''} | Issued by: ${r.issued_by || ''} | From: ${r.from_date || ''} | To: ${r.to_date || ''} | Status: ${r.status || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  equipment_service_logs: {
    textify: r => `Service Log | Equipment: ${r.equipment_id || ''} | Date: ${r.date || ''} | Type: ${r.type || ''} | Technician: ${r.technician || ''} | Next Due: ${r.next_due || ''} | Notes: ${r.notes || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  equipment_hire_logs: {
    textify: r => `Hire Log | Equipment: ${r.equipment_id || ''} | Name: ${r.name || ''} | Company: ${r.company || ''} | Daily Rate: ${r.daily_rate || ''} | Start: ${r.start_date || ''} | End: ${r.end_date || ''} | Project: ${r.project || ''} | Status: ${r.status || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  risk_mitigation_actions: {
    textify: r => `Mitigation Action: ${r.title || ''} | Risk: ${r.risk_id || ''} | Owner: ${r.owner || ''} | Due: ${r.due_date || ''} | Status: ${r.status || ''} | Progress: ${r.progress || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  contact_interactions: {
    textify: r => `Interaction | Contact: ${r.contact_id || ''} | Type: ${r.type || ''} | Date: ${r.date || ''} | Note: ${r.note || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  safety_permits: {
    textify: r => `Safety Permit: ${r.permit_no || ''} | Type: ${r.type || ''} | Project: ${r.project || ''} | Location: ${r.location || ''} | Start: ${r.start_date || ''} | End: ${r.end_date || ''} | Issued by: ${r.issued_by || ''} | Status: ${r.status || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  toolbox_talks: {
    textify: r => `Toolbox Talk | Date: ${r.date || ''} | Topic: ${r.topic || ''} | Location: ${r.location || ''} | Presenter: ${r.presenter || ''} | Attendees: ${r.attendees || ''} | Signed Off: ${r.signed_off || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  drawing_transmittals: {
    textify: r => `Drawing Transmittal | Project: ${r.project || ''} | Issued to: ${r.issued_to || ''} | Date: ${r.date || ''} | Purpose: ${r.purpose || ''} | Status: ${r.status || ''}`,
    getOrgId: r => r.organization_id || r.company_id,
  },
  // System tables with no direct entity representation — skip
  notifications:     { skip: true },
  audit_log:          { skip: true },
  users:              { skip: true },
  organizations:      { skip: true },
  companies:          { skip: true },
  ai_conversations:   { skip: true },
  document_versions:  { skip: true },
  permissions:        { skip: true },
  email_templates:    { skip: true },
  report_templates:   { skip: true },
};

/** Tables included in global semantic search */
const SEARCHABLE_TABLES = [
  'projects', 'invoices', 'safety_incidents', 'rfis', 'change_orders',
  'team_members', 'documents', 'subcontractors', 'contacts', 'tenders',
  'rams', 'meetings', 'daily_reports', 'materials', 'punch_list',
  'inspections', 'risk_register', 'purchase_orders', 'variations',
  'defects', 'valuations', 'specifications', 'temp_works', 'signage',
  'waste_management', 'sustainability', 'training', 'certifications',
  'prequalification', 'lettings', 'measuring', 'equipment',
];

module.exports = { manifest, SEARCHABLE_TABLES };
