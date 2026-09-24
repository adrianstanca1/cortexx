const test = require('node:test')
const assert = require('node:assert/strict')
const { riddorReviewRequired, initialRiddorStatus, closeoutReadiness } = require('../lib/safety-workflow')

test('serious incident types trigger RIDDOR review without auto-deciding reportability', () => {
  assert.equal(riddorReviewRequired('accident', 'low'), true)
  assert.equal(riddorReviewRequired('dangerous_occurrence', 'medium'), true)
  assert.equal(riddorReviewRequired('near_miss', 'critical'), true)
  assert.equal(riddorReviewRequired('near_miss', 'low'), false)
  assert.equal(initialRiddorStatus('accident', 'critical'), 'not_assessed')
  assert.equal(initialRiddorStatus('near_miss', 'low', true), 'reportable')
})

test('closeout blocks incomplete investigation, actions and RIDDOR decision', () => {
  const result = closeoutReadiness({ severity: 'high', riddorStatus: 'not_assessed' }, [{ status: 'open' }])
  assert.equal(result.ready, false)
  assert.ok(result.missing.includes('investigation_summary'))
  assert.ok(result.missing.includes('root_cause'))
  assert.ok(result.missing.includes('immediate_actions'))
  assert.ok(result.missing.includes('corrective_actions'))
  assert.ok(result.missing.includes('riddor_decision'))
})

test('explicit RIDDOR decision requires a recorded reason', () => {
  const result = closeoutReadiness({ severity: 'low', investigationSummary: 'Investigated', rootCause: 'Housekeeping', riddorStatus: 'not_reportable' }, [])
  assert.deepEqual(result, { ready: false, missing: ['riddor_reason'] })
})

test('reportable incident cannot close until RIDDOR is submitted', () => {
  const base = { severity: 'medium', investigationSummary: 'Investigated', rootCause: 'Loose guard', riddorStatus: 'reportable', riddorDecisionReason: 'Specified dangerous occurrence' }
  assert.deepEqual(closeoutReadiness(base, [{ status: 'complete' }]), { ready: false, missing: ['riddor_submission'] })
  const submitted = { ...base, riddorStatus: 'submitted', riddorReference: 'HSE-123', riddorSubmittedAt: '2026-09-24T12:00:00Z' }
  assert.deepEqual(closeoutReadiness(submitted, [{ status: 'complete' }]), { ready: true, missing: [] })
})

test('not-reportable investigated incident can close when actions complete and decision reason is recorded', () => {
  const incident = { severity: 'low', investigationSummary: 'Checked site', rootCause: 'Housekeeping', riddorStatus: 'not_reportable', riddorDecisionReason: 'No reportable injury criteria met' }
  assert.equal(closeoutReadiness(incident, [{ status: 'complete' }, { status: 'complete' }]).ready, true)
})
