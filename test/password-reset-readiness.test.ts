import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resendSenderDomain, requiredResendRecordsMatch } from '../lib/passwordResetReadiness'

const ready = {
  dkim: ['p=' + 'A'.repeat(70)],
  spf: ['v=spf1 include:amazonses.com ~all'],
  mx: [{ exchange: 'feedback-smtp.eu-west-1.amazonses.com', priority: 10 }],
  cname: ['send.forge.rmta.net'],
}

test('sender domain parser handles mailbox formats, rejects invalid domains', () => {
  assert.equal(resendSenderDomain('Cortex Construct <no-reply@cortexbuildpro.tech>'), 'cortexbuildpro.tech')
  assert.equal(resendSenderDomain('no-reply@cortexbuildpro.tech'), 'cortexbuildpro.tech')
  assert.equal(resendSenderDomain('invalid'), null)
})

test('recovery requires all four sender-authentication records', () => {
  assert.equal(requiredResendRecordsMatch(ready), true)
  assert.equal(requiredResendRecordsMatch({ ...ready, dkim: [] }), false)
  assert.equal(requiredResendRecordsMatch({ ...ready, spf: [] }), false)
  assert.equal(requiredResendRecordsMatch({ ...ready, mx: [] }), false)
  assert.equal(requiredResendRecordsMatch({ ...ready, cname: [] }), false)
})
