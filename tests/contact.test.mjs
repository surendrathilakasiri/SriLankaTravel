import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../api/contact.js';
import { handler } from '../netlify/functions/contact.js';
const body = { name: 'Test User', email: 'test@example.com', message: 'A sufficiently detailed inquiry.' };
for (const [label, invoke] of [
  ['Vercel', async () => { const r = await POST(new Request('https://example.com/api/contact', { method: 'POST', body: JSON.stringify(body) })); return r.status; }],
  ['Netlify', async () => (await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) })).statusCode]
]) {
  test(`${label}: fallback works after network failure; optional failures do not undo delivery`, async t => {
    t.mock.method(globalThis, 'fetch', async url => {
      if (url.includes('formsubmit')) return Response.json({ success: 'true' });
      throw new Error('offline');
    });
    const previous = { ...process.env };
    process.env.RESEND_API_KEY = 'test';
    process.env.CRM_WEBHOOK_URL = 'https://example.com/crm';
    process.env.CONTACT_AUTO_REPLY = 'true';
    globalThis.__contactRateStore = new Map();
    try { assert.equal(await invoke(), 200); }
    finally { process.env = previous; }
  });
  test(`${label}: HTTP 200 with rejected provider payload is not success`, async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ success: 'false' }));
    const previous = { ...process.env };
    delete process.env.RESEND_API_KEY;
    delete process.env.CRM_WEBHOOK_URL;
    globalThis.__contactRateStore = new Map();
    try { assert.equal(await invoke(), 502); }
    finally { process.env = previous; }
  });
}
