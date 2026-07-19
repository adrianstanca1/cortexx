import { test, describe } from 'node:test';
import assert from 'node:assert';
import { startStream, stopStream, onStreamEvent } from '../src/index.ts';

// Emulate the backend SSE endpoint with a fake fetch + ReadableStream so we
// can prove startStream() parses frames and fans them out to listeners, and
// that it reconnects after the stream closes.
function fakeServer(frames: string[], { closeAfter = frames.length } = {}) {
  let call = 0;
  // @ts-ignore install a controllable global fetch
  (globalThis as any)._origFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = async (_url: string) => {
    call++;
    const chunks = frames.map((f) => new TextEncoder().encode(f));
    let i = 0;
    const stream = new ReadableStream({
      pull(ctrl) {
        if (i < closeAfter) { ctrl.enqueue(chunks[i++]); }
        else { ctrl.close(); }
      },
    });
    return new Response(stream as any, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
}

describe('realtime SSE stream', () => {
  test('parses data: frames and fires listeners, then reconnects', async () => {
    fakeServer([
      'data: {"type":"connected"}\n\n',
      'data: {"type":"change","collection":"tasks","op":"create","id":"abc"}\n\n',
      'data: {"type":"change","collection":"invoices","op":"update","id":"xyz"}\n\n',
    ], { closeAfter: 3 }); // deliver all frames, then close -> triggers reconnect path

    const got: any[] = [];
    const off = onStreamEvent((e) => got.push(e));

    startStream({ apiUrl: 'https://example.com', token: 'tok' });

    // wait for frames + one reconnect attempt to fire (reconnect uses setTimeout 4s,
    // but the first connect delivers all frames synchronously-ish via microtasks)
    await new Promise((r) => setTimeout(r, 300));

    off();
    stopStream();
    (globalThis as any).fetch = (globalThis as any)._origFetch;

    const changes = got.filter((g) => g.type === 'change');
    assert.ok(changes.length >= 2, 'should have received at least 2 change events, got ' + changes.length);
    assert.strictEqual(changes[0].collection, 'tasks');
    assert.strictEqual(changes[0].op, 'create');
    assert.strictEqual(changes[1].collection, 'invoices');
  });
});
