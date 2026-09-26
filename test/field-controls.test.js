const test = require('node:test')
const assert = require('node:assert/strict')
const controls = require('../lib/field-controls')

test('production metrics calculate plan variance and labour productivity', () => {
  const m = controls.productionMetrics(100, 80, 16)
  assert.equal(m.varianceQty, -20)
  assert.equal(m.completionPct, 80)
  assert.equal(m.qtyPerLabourHour, 5)
  assert.equal(m.labourHoursPerUnit, 0.2)
})

test('hold and witness points require release before completion', () => {
  assert.equal(controls.initialReleaseStatus('inspection'), 'not_required')
  assert.equal(controls.initialReleaseStatus('hold'), 'pending')
  assert.equal(controls.canCompletePoint('hold', 'pending'), false)
  assert.equal(controls.canCompletePoint('hold', 'released'), true)
  assert.equal(controls.canCompletePoint('witness', 'released'), true)
})

test('delivery evidence only accepts same-origin upload URLs', () => {
  const e = controls.sanitizeEvidence({
    photoUrls: ['/api/uploads/a.jpg', 'https://evil.example/x.jpg'],
    signatureUrl: '/api/uploads/sign.png',
    signedBy: 'Site manager',
  })
  assert.deepEqual(e.photoUrls, ['/api/uploads/a.jpg'])
  assert.equal(e.signatureUrl, '/api/uploads/sign.png')
  assert.equal(e.signedBy, 'Site manager')
})

test('QA release evidence requires a valid uploaded photo or signature', () => {
  assert.equal(controls.hasReleaseEvidence({}), false)
  assert.equal(controls.hasReleaseEvidence({ photoUrls: ['https://evil.example/x.jpg'] }), false)
  assert.equal(controls.hasReleaseEvidence({ photoUrls: ['/api/uploads/qa.jpg'] }), true)
  assert.equal(controls.hasReleaseEvidence({ signatureUrl: '/api/uploads/sign.png' }), true)
})

test('constraint lifecycle is governed but can be reopened', () => {
  assert.equal(controls.canTransitionConstraintStatus('open', 'mitigating'), true)
  assert.equal(controls.canTransitionConstraintStatus('mitigating', 'resolved'), true)
  assert.equal(controls.canTransitionConstraintStatus('resolved', 'open'), true)
  assert.equal(controls.canTransitionConstraintStatus('resolved', 'mitigating'), false)
})
