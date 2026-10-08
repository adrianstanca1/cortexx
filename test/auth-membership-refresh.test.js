import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { refreshedMemberships } from '../lib/membershipRefresh.ts';

test('permission refresh fails closed on database lookup failure without trusting cached JWT roles', () => {
  assert.deepEqual(refreshedMemberships(null), { available: false });
  assert.deepEqual(refreshedMemberships([]), { available: true, rows: [] });
  const rows = [{ id: 'tenant-a', role: 'operative' }];
  assert.deepEqual(refreshedMemberships(rows), { available: true, rows });
});

test('both web authorization helpers require the fresh membership result', () => {
  const source = readFileSync(new URL('../lib/requireAuth.ts', import.meta.url), 'utf8');
  assert.equal((source.match(/if \(!membershipLookup\.available\) return permissionRefreshUnavailable\(\)/g) || []).length, 2);
  assert.equal(source.includes('if (freshOrgs !== null) orgs = freshOrgs'), false,
    'failure must not silently preserve stale membership claims');
});
