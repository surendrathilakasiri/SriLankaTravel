import test from 'node:test';
import assert from 'node:assert/strict';
import { createContactHandler } from '../lib/contact.js';
import { GET as inbox } from '../api/admin/contacts.js';
const body = { name: 'Test User', email: 'test@example.com', message: 'A sufficiently detailed inquiry.' };
const request = (data = body, headers = {}) => new Request('https://example.com/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
function setup(overrides = {}) {
  const saved = new Map();
  const store = {
    async read(_collection, id) { return saved.has(id) ? { record: saved.get(id) } : null; },
    async save(_collection, row) { saved.set(row.id, row); }
  };
  return { saved, handler: createContactHandler({ store, configured: () => true, rateLimit: () => true, notify: async () => false, ...overrides }) };
}
test('contact is durably saved even when optional email notification fails', async () => {
  const { saved, handler } = setup();
  assert.equal((await handler(request())).status, 200);
  assert.equal(saved.size, 1);
  assert.equal([...saved.values()][0].message, body.message);
});
test('storage failure never claims a successful submission', async () => {
  const { handler } = setup({ store: { save: async () => { throw Error('offline'); }, read: async () => null } });
  assert.equal((await handler(request())).status, 503);
});
test('retry of a submission does not duplicate records or notification', async () => {
  let notifications = 0;
  const { saved, handler } = setup({ notify: async () => { notifications++; } });
  const data = { ...body, submission_id: '8000000000000-12345678-1234-1234-1234-123456789abc' };
  assert.equal((await handler(request(data))).status, 200);
  assert.equal((await handler(request(data))).status, 200);
  assert.equal(saved.size, 1);
  assert.equal(notifications, 1);
  assert.equal((await handler(request({ ...data, message: 'A different sufficiently long message.' }))).status, 409);
});
test('native form redirects only after storage and remains on the same domain', async () => {
  const { saved, handler } = setup();
  const response = await handler(new Request('https://example.com/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/contact.html?sent=1');
  assert.equal(saved.size, 1);
});
test('validation and cross-origin requests cannot write private storage', async () => {
  const { saved, handler } = setup();
  assert.equal((await handler(request({ ...body, email: 'invalid' }))).status, 400);
  assert.equal((await handler(request(body, { Origin: 'https://other.example' }))).status, 403);
  assert.equal(saved.size, 0);
});
test('contact inbox rejects unauthenticated readers and is never cacheable', async () => {
  const response = await inbox(new Request('https://example.com/api/admin/contacts'));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});
