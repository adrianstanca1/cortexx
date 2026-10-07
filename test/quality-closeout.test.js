const test = require('node:test')
const assert = require('node:assert/strict')
const closeout = require('../lib/quality-closeout')

test('snag closeout requires both resolution and trusted upload evidence', () => {
  assert.deepEqual(closeout.snagCloseoutReadiness({}).missing, ['resolution', 'closeout_evidence'])
  assert.deepEqual(closeout.snagCloseoutReadiness({ resolution: 'Re-fixed panel' }).missing, ['closeout_evidence'])
  assert.deepEqual(closeout.snagCloseoutReadiness({ resolution: 'Re-fixed panel', closeoutEvidence: { photoUrls: ['https://evil.example/claim.jpg'] } }).missing, ['closeout_evidence'])
  const ready = closeout.snagCloseoutReadiness({ resolution: 'Re-fixed panel and checked fixings', closeoutEvidence: { photoUrls: ['/api/uploads/closeout.jpg'] } })
  assert.equal(ready.ready, true)
  assert.equal(ready.resolution, 'Re-fixed panel and checked fixings')
})

test('failed inspection cannot be flipped to passed without verification evidence', () => {
  assert.deepEqual(closeout.inspectionPassReadiness({ previousStatus: 'failed', evidence: {} }).missing, ['verification_evidence'])
  assert.equal(closeout.inspectionPassReadiness({ previousStatus: 'failed', evidence: { photoUrls: ['/api/uploads/qa-close.jpg'] } }).ready, true)
})

test('inspection cannot pass while checklist still contains a failed item', () => {
  const result = closeout.inspectionPassReadiness({ previousStatus: 'in_progress', checklistItems: [{ result: 'pass' }, { result: 'fail' }] })
  assert.deepEqual(result.missing, ['failed_checklist_items'])
})

test('ordinary passing inspection does not invent a photo requirement', () => {
  assert.equal(closeout.inspectionPassReadiness({ previousStatus: 'in_progress', checklistItems: [{ result: 'pass' }] }).ready, true)
})
