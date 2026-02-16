import { createPending } from "./_lib/liveDataStore.js";

function clean(v) {
  return String(v || "").trim();
}

function validCategory(v) {
  return ["taxi-fee", "tax", "hotel-price", "place", "event"].includes(v);
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function processSubmission(bodyInput) {
  const body = bodyInput || {};

  const category = clean(body.category);
  const city = clean(body.city);
  const title = clean(body.title);
  const details = clean(body.details);
  const priceInfo = clean(body.price_info);
  const sourceUrl = clean(body.source_url);
  const submitterEmail = clean(body.submitter_email);
  const eventStart = clean(body.event_start) || null;
  const eventEnd = clean(body.event_end) || null;
  const honey = clean(body._honey);

  if (honey) return { status: 200, payload: { ok: true } };

  if (!validCategory(category)) {
    return { status: 400, payload: { error: "Invalid category." } };
  }
  if (!city || city.length < 2 || city.length > 80) {
    return { status: 400, payload: { error: "Please enter a valid city." } };
  }
  if (!title || title.length < 6 || title.length > 140) {
    return { status: 400, payload: { error: "Title must be 6-140 characters." } };
  }
  if (!details || details.length < 15 || details.length > 2000) {
    return { status: 400, payload: { error: "Details must be 15-2000 characters." } };
  }
  if (!submitterEmail || !validEmail(submitterEmail)) {
    return { status: 400, payload: { error: "Please enter a valid email." } };
  }
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    return {
      status: 400,
      payload: { error: "Source URL must start with http:// or https://" }
    };
  }

  const row = await createPending({
    category,
    city,
    title,
    details,
    price_info: priceInfo,
    event_start: eventStart,
    event_end: eventEnd,
    source_url: sourceUrl,
    submitter_email: submitterEmail
  });

  return { status: 200, payload: { ok: true, id: row?.id || null } };
}

function respond(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const out = await processSubmission(body);
    return respond(out.status, out.payload);
  } catch (err) {
    return respond(500, { error: `Server error: ${err?.message || "Unknown"}` });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const out = await processSubmission(body);
    return res.status(out.status).json(out.payload);
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err?.message || "Unknown"}` });
  }
}
