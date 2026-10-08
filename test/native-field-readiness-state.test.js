import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readinessState } from '../expo/field-readiness-state.ts';

test('site readiness never declares clear without a selected project and complete live feeds', () => {
  assert.equal(readinessState({ projectId: null, feedsComplete: true, blockerCount: 0 }), 'unverified');
  assert.equal(readinessState({ projectId: 'project-a', feedsComplete: false, blockerCount: 0 }), 'unverified');
  assert.equal(readinessState({ projectId: 'project-a', feedsComplete: false, blockerCount: 2 }), 'unverified');
  assert.equal(readinessState({ projectId: 'project-a', feedsComplete: true, blockerCount: 2 }), 'blocked');
  assert.equal(readinessState({ projectId: 'project-a', feedsComplete: true, blockerCount: 0 }), 'clear');
});
