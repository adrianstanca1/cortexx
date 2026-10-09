const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', 'expo', name), 'utf8');

test('native invoices and quotes offer full authorized editing in shared web workspace', () => {
  const tabs = source('Tabs.tsx');
  assert.match(tabs, /name="invoices" title="Invoices" readOnly onOpenFullWorkspace=\{\(\) => onOpenWeb\('\/invoices'\)\}/);
  assert.match(tabs, /name="quotes" title="Quotes" readOnly onOpenFullWorkspace=\{\(\) => onOpenWeb\('\/quotes'\)\}/);
  assert.match(tabs, /<WebWorkspaceScreen path=\{webPath\}/);
});

test('read-only collection never offers native unvalidated finance writes', () => {
  const collection = source('CollectionScreen.tsx');
  assert.match(collection, /!readOnly \? <TouchableOpacity onPress=\{openAdd\}>/);
  assert.match(collection, /onPress=\{onOpenFullWorkspace\}/);
  assert.match(collection, /No records available\. Use the full workspace to create one/);
});
