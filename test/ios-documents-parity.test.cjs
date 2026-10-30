const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const src = relative => readFileSync(join(__dirname, '..', relative), 'utf8');

test('native documents are reachable from the iOS module navigation', () => {
  assert.match(src('expo/MoreScreen.tsx'), /route: 'documents', title: 'Documents'/);
  assert.match(src('expo/routes.ts'), /\| 'documents'/);
  assert.match(src('expo/Tabs.tsx'), /<DocumentsScreen user=\{user\} onLogout=\{onLogout\} onOpenWeb=\{onOpenWeb\}/);
});
test('document picker and storage enforce existing backend file allowlist and upload limit', () => {
  const native = src('expo/DocumentsScreen.tsx');
  const backend = src('lib/storage.ts');
  const limit = src('app/api/uploads/route.ts');
  for (const mime of ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']) {
    assert.ok(native.includes(`'${mime}'`), `Picker must offer ${mime}`);
    assert.ok(backend.includes(`'${mime}'`), `Server must accept ${mime}`);
  }
  assert.match(native, /25 \* 1024 \* 1024/);
  assert.match(limit, /MAX_UPLOAD_BYTES/);
  assert.match(native, /DocumentPicker\.getDocumentAsync/);
  assert.match(native, /copyToCacheDirectory: true/);
});
test('native upload connects file metadata to the same authenticated project documents route', () => {
  const native = src('expo/DocumentsScreen.tsx');
  assert.match(native, /uploadNativeFile\(\{ uri: asset\.uri, name: asset\.name, mimeType \}\)/);
  assert.match(native, /apiPost\('\/api\/documents', \{/);
  assert.match(native, /projectId, url: stored\.url, size: stored\.size, mimeType: stored\.mimeType/);
  assert.match(native, /if \(!projectId\)/);
  assert.match(native, /openDrawingFile\(item\.url, item\.name\)/);
  assert.match(native, /onOpenWeb\('\/documents'\)/);
});
test('native document list supports organization-scoped pagination and project filters', () => {
  const native = src('expo/DocumentsScreen.tsx');
  assert.match(native, /\/api\/documents\?take=\$\{PAGE_SIZE\}&skip=\$\{skip\}\$\{suffix\}/);
  assert.match(native, /encodeURIComponent\(selected\)/);
  assert.match(native, /setHasMore\(!!result\?\.hasMore\)/);
  assert.match(native, /accessibilityLabel="Load more documents"/);
  assert.match(native, /const canUpload = \['owner', 'admin', 'member'\]/);
});
