const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const src = path => readFileSync(join(__dirname, '..', path), 'utf8');

test('projects use the supported backend take parameter, not a silently ignored limit', () => {
  assert.match(src('packages/core/src/index.ts'), /apiGet\('\/api\/projects\?take=100'\)/);
});
test('native project creation enforces organization admin role and uses the shared backend', () => {
  const projects = src('expo/ProjectsScreen.tsx');
  assert.match(projects, /membershipRole === 'owner' \|\| membershipRole === 'admin'/);
  assert.match(projects, /!canCreateProject \|\| saving/);
  assert.match(projects, /apiPost\('\/api\/projects',/);
  assert.match(projects, /Number\.isFinite\(budget\)/);
  assert.match(projects, /accessibilityLabel="Create a project"/);
  assert.match(projects, /accessibilityLabel="Save new project"/);
  assert.match(projects, /onSelect\(project\.id\)/);
});
test('project overview links to complete per-project web management and Safari fallback', () => {
  const tabs = src('expo/Tabs.tsx');
  const detail = src('expo/ProjectDetailScreen.tsx');
  assert.match(tabs, /<ProjectsScreen user=\{user\}/);
  assert.match(tabs, /<ProjectDetailScreen[\s\S]*?onOpenWeb=\{onOpenWeb\}/);
  assert.match(detail, /onOpenWeb\(`\/projects\/\$\{encodeURIComponent\(id\)\}`\)/);
  assert.match(detail, /accessibilityLabel="Open complete project workspace"/);
});
