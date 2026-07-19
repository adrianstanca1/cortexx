// Push native (Expo) delivery — integration test.
// Mocks https so no real network call leaves the box; asserts the
// /push/send route delivers to Expo's push service for a native token.

const assert = require('assert');
const Module = require('module');
const { test } = require('node:test');

// Capture the outgoing Expo request.
let captured = null;
function fakeHttps() {
  return {
    request(_opts, cb) {
      return {
        on() {},
        write(body) { captured = JSON.parse(body); },
        end() {
          const res = {
            statusCode: 200,
            on(evt, fn) { if (evt === 'data') fn('{}'); if (evt === 'end') fn(); },
          };
          cb(res);
        },
      };
    },
  };
}

const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'https') return fakeHttps();
  return origLoad.apply(this, arguments);
};

const pushRouter = require('../server/routes/push');

test('native token is delivered to Expo push service', async () => {
  captured = null;

  const req = {
    method: 'POST',
    url: '/push/send',
    baseUrl: '',
    body: { title: 'New job', body: 'Site A assigned', url: '/jobs' },
    user: { uid: 'u1', ws: 'ws1' },
    app: {
      locals: {
        pool: {
          query: async (sql) => {
            if (String(sql).includes('SELECT role FROM users')) {
              return { rows: [{ role: 'admin' }] };
            }
            return {
              rows: [
                { endpoint: 'native:ExponentPushToken[abc123]', sub: { token: 'ExponentPushToken[abc123]' } },
              ],
            };
          },
        },
      },
    },
  };
  let status = 200;
  let json = null;
  let done = null;
  const doneP = new Promise((res2) => { done = res2; });
  const res = {
    status(c) { status = c; return this; },
    json(j) { json = j; done(); return this; },
  };

  pushRouter.handle(req, res, () => {});
  await doneP;

  assert.strictEqual(status, 200, 'should return 200');
  assert.ok(captured, 'should have POSTed to Expo');
  assert.strictEqual(captured.to, 'ExponentPushToken[abc123]');
  assert.strictEqual(captured.title, 'New job');
  assert.strictEqual(captured.body, 'Site A assigned');
  assert.strictEqual(captured.data.url, '/jobs');
  assert.strictEqual(json.sent, 1, 'should report 1 sent');
  assert.strictEqual(json.failed, 0);
});

Module._load = origLoad;
