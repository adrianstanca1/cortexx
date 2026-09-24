const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkHealth } = require('../scripts/check-construction-health.cjs');
const { version } = require('../package.json');
const root = path.resolve(__dirname, '..');

test('deployment rejects a healthy response from the video app or a disconnected database', () => {
  assert.equal(checkHealth({ status: 'ok', service: 'viral-shorts-studio' }), false);
  const health = { status: 'ok', version, service: 'cortexbuild-construction', checks: { database: { ok: true } }, timestamp: new Date().toISOString() };
  assert.equal(checkHealth(health), true);
  assert.equal(checkHealth({ ...health, checks: { database: { ok: false } } }), false);
  assert.equal(checkHealth({ ...health, version: '0.0.0' }), false);
  assert.equal(checkHealth(null), false);
});

test('deployment asset mounts point to actual files or directories', () => {
  const compose = fs.readFileSync(path.join(root, 'docker-compose.cortexx.yml'), 'utf8');
  for (const match of compose.matchAll(/^\s+- \.\/([^:]+):\/srv\/app\//gm)) {
    assert.ok(fs.existsSync(path.join(root, match[1])), `Missing bind mount: ${match[1]}`);
  }
  for (const page of ['privacy.html', 'terms.html']) assert.ok(compose.includes(`./${page}:/srv/app/${page}:ro`));
});

test('API Dockerfile copies every top-level runtime module required by index', () => {
  const source = fs.readFileSync(path.join(root, 'server/index.js'), 'utf8');
  const dockerfile = fs.readFileSync(path.join(root, 'server/Dockerfile'), 'utf8');
  for (const match of source.matchAll(/require\('\.\/([\w-]+)'\)/g)) {
    assert.ok(dockerfile.includes(match[1] + '.js'), `Docker image omits ${match[1]}.js`);
  }
});
