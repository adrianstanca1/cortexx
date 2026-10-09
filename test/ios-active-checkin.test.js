import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectActiveCheckIn } from '../expo/checkin-active.ts'

test('authoritative active-only lookup finds an older active shift missing from the first 100 history rows', () => {
  const recent = Array.from({ length: 100 }, (_, i) => ({ memberId: 'm1', id: `closed-${i}`, checkedOutAt: '2026-10-09T10:00:00Z' }))
  const open = { memberId: 'm1', id: 'old-active', checkedOutAt: null }
  assert.equal(selectActiveCheckIn(recent, 'm1', open)?.id, 'old-active')
})
test('verified server absence overrides a stale cached history showing an open shift', () => {
  const cached = [{ memberId: 'm1', id: 'stale-open', checkedOutAt: null }]
  assert.equal(selectActiveCheckIn(cached, 'm1', null), null)
  assert.equal(selectActiveCheckIn(cached, 'm1', undefined)?.id, 'stale-open')
})
test('no linked member never shows another worker attendance', () => {
  const history = [{ memberId: 'worker-a', id: 'a', checkedOutAt: null }]
  assert.equal(selectActiveCheckIn(history, undefined, history[0]), undefined)
  assert.equal(selectActiveCheckIn(history, 'worker-b', undefined), undefined)
})
test('iOS check-in uses a token-authenticated member-scoped active status route', () => {
  const source = readFileSync(new URL('../expo/CheckInScreen.tsx', import.meta.url), 'utf8')
  const server = readFileSync(new URL('../app/api/checkins/route.ts', import.meta.url), 'utf8')
  assert.match(source, /apiGet\(`\/api\/checkins\?activeOnly=true&memberId=\$\{encodeURIComponent\(m.id\)\}&take=1`\)/)
  assert.match(source, /setVerifiedActive\(activeResponse\.checkins\[0\] \|\| null\)/)
  assert.match(server, /searchParams\.get\('activeOnly'\) === 'true'/)
  assert.match(server, /searchParams\.get\('memberId'\)/)
})
