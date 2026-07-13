const MAX_WEBHOOK_BYTES = 256 * 1024;

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    if (!hasRequiredSecrets(env)) return new Response('Gateway is not configured', { status: 500 });

    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_WEBHOOK_BYTES) return new Response('Payload Too Large', { status: 413 });

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_WEBHOOK_BYTES) {
      return new Response('Payload Too Large', { status: 413 });
    }

    const signature = request.headers.get('x-line-signature') || '';
    if (!await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const upstream = await fetch(env.GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ gatewayToken: env.GATEWAY_SHARED_SECRET, lineBody: rawBody }),
      redirect: 'follow',
    });
    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8' },
    });
  },
};

function hasRequiredSecrets(env) {
  return Boolean(env && env.LINE_CHANNEL_SECRET && env.GAS_WEB_APP_URL && env.GATEWAY_SHARED_SECRET);
}

export async function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!rawBody || !signature || !channelSecret) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = arrayBufferToBase64(digest);
  return constantTimeEqual(signature, expected);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length || left.length === 0) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}
