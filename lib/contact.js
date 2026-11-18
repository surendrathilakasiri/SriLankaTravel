import { createHash } from 'node:crypto';
import { records, recordId, storageConfigured } from './records.js';

const submissions = new Map();
function allowed(ip) {
  const now = Date.now();
  for (const [key, value] of submissions) if (value.until < now) submissions.delete(key);
  if (submissions.size > 10000) submissions.delete(submissions.keys().next().value);
  const entry = submissions.get(ip) || { count: 0, until: now + 600000 };
  submissions.set(ip, entry);
  return ++entry.count <= 5;
}
export async function notifyContact(record) {
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_FROM_EMAIL) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `contact-${record.id}` },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM_EMAIL,
        to: [process.env.CONTACT_TO_EMAIL || 'surendrakoththigoda@gmail.com'],
        reply_to: record.email,
        subject: `Website contact: ${record.topic}`,
        text: `Name: ${record.name}\nEmail: ${record.email}\nTopic: ${record.topic}\nReference: ${record.id}\n\n${record.message}`
      })
    });
    if (!response.ok) console.error('Contact notification failed', { status: response.status });
    return response.ok;
  } catch { console.error('Contact notification failed: network error'); return false; }
}
export function createContactHandler({ store = records, configured = storageConfigured, notify = notifyContact, rateLimit = allowed } = {}) {
  return async function POST(request) {
    const isForm = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded');
    function respond(status, payload) {
      if (isForm && status === 200) return new Response(null, { status: 303, headers: { Location: '/contact.html?sent=1', 'Cache-Control': 'no-store' } });
      if (isForm) return new Response('Your message was not saved. Please return to the contact page and try again, or email surendrakoththigoda@gmail.com.', { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
      return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
    }
    try {
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin) return respond(403, { error: 'Please submit from this website.' });
      const text = await request.text();
      if (text.length > 20000) return respond(413, { error: 'Message is too large.' });
      let body;
      try { body = isForm ? Object.fromEntries(new URLSearchParams(text)) : JSON.parse(text); }
      catch { return respond(400, { error: 'Please check your message and try again.' }); }
      if (!body || typeof body !== 'object') return respond(400, { error: 'Invalid message.' });
      if (body._honey) return respond(200, { ok: true });
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim();
      const message = String(body.message || '').trim();
      const topic = String(body.topic || 'General inquiry').trim();
      const source = String(body.source || 'contact-page').trim();
      if (name.length < 2 || name.length > 80) return respond(400, { error: 'Please provide a valid name.' });
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(400, { error: 'Please provide a valid email.' });
      if (message.length < 15 || message.length > 4000) return respond(400, { error: 'Message must be 15–4000 characters.' });
      if (topic.length > 120 || /[\r\n]/.test(topic) || source.length > 100) return respond(400, { error: 'Please shorten the topic.' });
      if ((message.match(/https?:\/\//gi) || []).length > 3) return respond(400, { error: 'Please reduce links in your message.' });
      if (!configured()) return respond(503, { error: 'Messages are temporarily unavailable. Please email surendrakoththigoda@gmail.com.' });
      const content = { name, email, topic, message, source };
      const fingerprint = createHash('sha256').update(JSON.stringify(content)).digest('hex');
      const submittedId = String(body.submission_id || '');
      if (submittedId && !/^\d{13}-[a-f0-9-]{36}$/.test(submittedId)) return respond(400, { error: 'Invalid submission reference. Please reload and try again.' });
      const id = submittedId || recordId();
      const previous = submittedId ? await store.read('contacts', id) : null;
      if (previous) {
        if (previous.record.fingerprint !== fingerprint) return respond(409, { error: 'This reference was already used. Please reload before sending a new message.' });
        return respond(200, { ok: true, id });
      }
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
      if (!rateLimit(ip)) return respond(429, { error: 'Too many messages. Please try again in ten minutes.' });
      const record = { id, ...content, fingerprint, created_at: new Date().toISOString() };
      try { await store.save('contacts', record); }
      catch (error) {
        // A simultaneous retry may have created the same record already.
        const saved = await store.read('contacts', id).catch(() => null);
        if (saved?.record.fingerprint === fingerprint) return respond(200, { ok: true, id });
        throw error;
      }
      await notify(record);
      return respond(200, { ok: true, id });
    } catch {
      console.error('Contact save failed');
      return respond(503, { error: 'We could not confirm your message was saved. Please retry, or email surendrakoththigoda@gmail.com.' });
    }
  };
}
