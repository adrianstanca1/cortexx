import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoSource } from '../expo/photo-media';
const origin = 'https://cortexbuildpro.tech';

test('on-site photo uses private upload URL with bearer scoped to current app', () => {
  const image = photoSource('/api/uploads/a_123.jpg', 'example-token', origin);
  assert.equal(image?.uri, origin + '/api/uploads/a_123.jpg?stream=1');
  assert.equal(image?.headers?.Authorization, 'Bearer example-token');
});

test('external HTTPS photo is public and never receives a bearer', () => {
  const image = photoSource('https://cdn.example.com/site-photo.jpg', 'example-token', origin);
  assert.equal(image?.uri, 'https://cdn.example.com/site-photo.jpg');
  assert.equal(image?.headers, undefined);
});

test('unsafe photo URLs and missing tokens are rejected', () => {
  for (const url of ['http://cdn.example.com/photo.jpg', '//cdn.example.com/p.jpg', '/api/projects/123',
    'https://user:pass@cdn.example.com/photo.jpg', '/api/uploads/../secret', 'javascript:alert(1)']) {
    assert.equal(photoSource(url, 'example-token', origin), null, url);
  }
  assert.equal(photoSource('/api/uploads/photo.jpg', null, origin), null);
});
