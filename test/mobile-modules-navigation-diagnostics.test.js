const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', 'expo', name), 'utf8');
test('mobile native tools are immediately visible alongside full web catalogue', () => {
  const menu = source('MoreScreen.tsx');
  assert.match(menu, /useState\(true\)/);
  assert.match(menu, /native\.length\} native tools/);
});
test('web module HTTP and transport failures show actionable retry', () => {
  const screen = source('WebWorkspaceScreen.tsx');
  assert.match(screen, /onHttpError=/);
  assert.match(screen, /nativeEvent\.statusCode >= 400/);
  assert.match(screen, /setWebFailure\(/);
  assert.match(screen, /accessibilityLabel="Retry web module"/);
});

test('failed embedded workspace has a secure browser fallback without leaking a ticket', () => {
  const screen = source('WebWorkspaceScreen.tsx');
  assert.match(screen, /accessibilityLabel="Open current module in Safari"/);
  assert.match(screen, /accessibilityLabel="Open failed module in Safari"/);
  assert.match(screen, /Linking\.openURL\(`\$\{API_URL\}\$\{safePath\}`\)/);
  assert.doesNotMatch(screen, /Linking\.openURL\([^\n]*ticket/);
});
