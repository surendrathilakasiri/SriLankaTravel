import { createPending } from "./_lib/liveDataStore.js";

function clean(v) {
  return String(v || "").trim();
}

function validCategory(v) {
  return ["tax", "hotel-price", "place", "event"].includes(v);
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

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

    if (honey) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!validCategory(category)) {
      return new Response(JSON.stringify({ error: "Invalid category." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!city || city.length < 2 || city.length > 80) {
      return new Response(JSON.stringify({ error: "Please enter a valid city." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!title || title.length < 6 || title.length > 140) {
      return new Response(JSON.stringify({ error: "Title must be 6-140 characters." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!details || details.length < 15 || details.length > 2000) {
      return new Response(JSON.stringify({ error: "Details must be 15-2000 characters." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!submitterEmail || !validEmail(submitterEmail)) {
      return new Response(JSON.stringify({ error: "Please enter a valid email." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      return new Response(JSON.stringify({ error: "Source URL must start with http:// or https://" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
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

    return new Response(JSON.stringify({ ok: true, id: row?.id || null }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Server error: ${err?.message || "Unknown"}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
