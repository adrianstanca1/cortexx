const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, '..', 'expo', 'DeliveriesScreen.tsx'), 'utf8')

test('native deliveries support up to six evidence photos', () => {
  assert.match(source, /deliveryPhotos.*ImagePickerAsset\[\]/)
  assert.match(source, /deliveryPhotos\.length >= 6/)
  assert.match(source, /selectionLimit:\s*remaining/)
  assert.match(source, /\.slice\(0, 6\)/)
})

test('native deliveries support camera and photo-library evidence', () => {
  assert.match(source, /launchCameraAsync/)
  assert.match(source, /requestMediaLibraryPermissionsAsync/)
  assert.match(source, /launchImageLibraryAsync/)
  assert.match(source, /allowsMultipleSelection:\s*true/)
})

test('native delivery evidence uploads every selected photo and preserves signature evidence', () => {
  assert.match(source, /Promise\.all\(deliveryPhotos\.map/)
  assert.match(source, /photoUrls:\s*deliveryPhotoUrls\.filter/)
  assert.match(source, /signatureUrl/)
})

test('native delivery evidence can be removed before submission', () => {
  assert.match(source, /removeEvidencePhoto/)
  assert.match(source, /Remove delivery photo/)
})
