import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const { default: worker, verifyLineSignature } = await import('../src/index.js');

const body = JSON.stringify({ destination: 'U123', events: [] });
const secret = 'test-channel-secret';
const signature = createHmac('sha256', secret).update(body).digest('base64');

test('verifies a valid LINE signature and rejects invalid signatures', async () => {
  assert.equal(await verifyLineSignature(body, signature, secret), true);
  assert.equal(await verifyLineSignature(body, 'invalid', secret), false);
  assert.equal(await verifyLineSignature(body, '', secret), false);
});

test('rejects requests without a valid LINE signature', async () => {
  const response = await worker.fetch(new Request('https://gateway.example', { method: 'POST', body }), {
    LINE_CHANNEL_SECRET: secret,
    GAS_WEB_APP_URL: 'https://script.google.com/macros/s/test/exec',
    GATEWAY_SHARED_SECRET: 'gateway-secret',
  });
  assert.equal(response.status, 401);
});

test('forwards only verified requests in an authenticated envelope', async () => {
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (url, options) => {
    forwarded = { url, options };
    return new Response('OK', { status: 200, headers: { 'content-type': 'text/plain' } });
  };
  try {
    const request = new Request('https://gateway.example', {
      method: 'POST', body,
      headers: { 'x-line-signature': signature },
    });
    const response = await worker.fetch(request, {
      LINE_CHANNEL_SECRET: secret,
      GAS_WEB_APP_URL: 'https://script.google.com/macros/s/test/exec',
      GATEWAY_SHARED_SECRET: 'gateway-secret',
    });
    assert.equal(response.status, 200);
    assert.equal(forwarded.url, 'https://script.google.com/macros/s/test/exec');
    assert.deepEqual(JSON.parse(forwarded.options.body), {
      gatewayToken: 'gateway-secret', lineBody: body,
    });
  } finally { globalThis.fetch = originalFetch; }
});
