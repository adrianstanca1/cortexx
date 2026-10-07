'use strict'

const controls = require('./field-controls')

function snagCloseoutReadiness(input = {}) {
  const missing = []
  const resolution = controls.cleanText(input.resolution, 2000)
  const evidence = controls.sanitizeEvidence(input.closeoutEvidence)
  if (!resolution) missing.push('resolution')
  if (!controls.hasReleaseEvidence(evidence)) missing.push('closeout_evidence')
  return { ready: missing.length === 0, missing, resolution, evidence }
}

function inspectionPassReadiness(input = {}) {
  const missing = []
  const checklist = Array.isArray(input.checklistItems) ? input.checklistItems : []
  if (checklist.some(item => item?.result === 'fail')) missing.push('failed_checklist_items')
  const isFailureCloseout = input.previousStatus === 'failed'
  const evidence = controls.sanitizeEvidence(input.evidence)
  if (isFailureCloseout && !controls.hasReleaseEvidence(evidence)) missing.push('verification_evidence')
  return { ready: missing.length === 0, missing, evidence, isFailureCloseout }
}

module.exports = { snagCloseoutReadiness, inspectionPassReadiness }
