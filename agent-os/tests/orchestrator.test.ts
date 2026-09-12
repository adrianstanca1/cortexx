import test from 'node:test';
import assert from 'node:assert/strict';
import { Orchestrator } from '../packages/core/src/orchestrator.js';
import { ModelRouter } from '../packages/core/src/modelRouter.js';

test('mission is planned, delegated and completed', () => {
  const o = new Orchestrator();
  const mission = o.createMission('Build an API');
  const result = o.runMission(mission.id);
  assert.equal(result.status, 'completed');
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].assignedAgentId, 'developer');
});

test('model router is local-first for routine work', () => {
  assert.equal(new ModelRouter('qwen-test').route(3).provider, 'ollama');
});
