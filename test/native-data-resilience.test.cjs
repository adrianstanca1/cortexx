const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const src = (name) => readFileSync(join(__dirname, '..', 'expo', name), 'utf8');

test('native project detail unwraps the actual API project response', () => {
  const s = src('ProjectDetailScreen.tsx');
  assert.match(s, /response\?\.project \|\| response/);
  for (const key of ['clientName', 'address', 'budget', 'progress', 'endDate']) assert.ok(s.includes(key), `Missing canonical project field ${key}`);
  assert.match(s, /setError\(e\?\.message/);
});
test('native portfolio uses current web backend project model aliases', () => {
  const s = src('ProjectsScreen.tsx');
  assert.match(s, /item\.budget \?\? item\.value/);
  assert.match(s, /item\.progress \?\? item\.pct/);
  assert.match(s, /item\.clientName \|\| item\.client/);
});
test('mobile dashboard and work queue survive independent endpoint failures', () => {
  const home = src('OverviewScreen.tsx');
  const tasks = src('TasksScreen.tsx');
  assert.match(home, /Promise\.allSettled\(/);
  assert.match(tasks, /Promise\.allSettled\(/);
  assert.match(home, /if \(failed\) setErr\(/);
  assert.match(tasks, /if \(failed\) setErr\(/);
  assert.match(home, /value: unavailable\(0\) \? '—'/);
  assert.match(home, /throw new Error\('unauthorized'\)/);
});
