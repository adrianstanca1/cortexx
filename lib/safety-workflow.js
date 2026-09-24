'use strict'

const RIDDOR_STATUSES = new Set(['not_assessed', 'not_reportable', 'reportable', 'submitted'])

// A generic accident/critical severity should trigger a RIDDOR review, not an
// automatic legal conclusion. HSE reportability depends on the incident facts
// (e.g. specified injury, >7-day incapacity, defined dangerous occurrence).
function riddorReviewRequired(type, severity) {
  return type === 'accident' || type === 'dangerous_occurrence' || severity === 'critical'
}

function initialRiddorStatus(_type, _severity, explicitReportable) {
  return explicitReportable === true ? 'reportable' : 'not_assessed'
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function closeoutReadiness(incident, actions = []) {
  const missing = []
  if (!nonEmpty(incident?.investigationSummary)) missing.push('investigation_summary')
  if (!nonEmpty(incident?.rootCause)) missing.push('root_cause')
  if (['high', 'critical'].includes(String(incident?.severity || '')) && !nonEmpty(incident?.immediateActions)) missing.push('immediate_actions')
  if ((actions || []).some(action => action?.status !== 'complete')) missing.push('corrective_actions')

  const riddorStatus = String(incident?.riddorStatus || 'not_assessed')
  if (!RIDDOR_STATUSES.has(riddorStatus) || riddorStatus === 'not_assessed') missing.push('riddor_decision')
  if (['not_reportable', 'reportable', 'submitted'].includes(riddorStatus) && !nonEmpty(incident?.riddorDecisionReason)) missing.push('riddor_reason')
  if (riddorStatus === 'reportable') missing.push('riddor_submission')
  if (riddorStatus === 'submitted') {
    if (!nonEmpty(incident?.riddorReference)) missing.push('riddor_reference')
    if (!incident?.riddorSubmittedAt) missing.push('riddor_submitted_at')
  }

  return { ready: missing.length === 0, missing: [...new Set(missing)] }
}

module.exports = { RIDDOR_STATUSES, riddorReviewRequired, initialRiddorStatus, closeoutReadiness }
