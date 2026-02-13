// api/itinerary.js
import OpenAI from "openai";

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min || i > max) return null;
  return i;
}

function normalizeCities(citiesRaw) {
  // trim + collapse spaces + remove empties
  const cleaned = (Array.isArray(citiesRaw) ? citiesRaw : [])
    .map((c) => String(c || "").trim().replace(/\s+/g, " "))
    .filter(Boolean);

  // dedupe while preserving order (case-insensitive)
  const seen = new Set();
  const unique = [];
  for (const c of cleaned) {
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  return unique;
}

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is missing in Vercel environment variables." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json().catch(() => ({}));

    const cities = normalizeCities(body.cities);
    const travelers = clampInt(body.travelers, 1, 20);
    const days = clampInt(body.days, 1, 30);
    const style = String(body.style || "balanced").trim().slice(0, 30);

    if (!cities.length) {
      return new Response(JSON.stringify({ error: "Please select at least one city." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!travelers) {
      return new Response(JSON.stringify({ error: "Invalid travelers value (must be 1–20)." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!days) {
      return new Response(JSON.stringify({ error: "Invalid days value (must be 1–30)." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // sanity check city lengths
    for (const c of cities) {
      if (c.length < 2 || c.length > 40) {
        return new Response(JSON.stringify({ error: `Invalid city name: "${c}"` }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const client = new OpenAI({ apiKey });

    // IMPORTANT: If you require "breakdown costs" you cannot *really* guarantee <=100 words.
    // So we enforce a small JSON + strict token cap to keep output short.
    const schemaRules = `
Return ONLY valid JSON (no markdown, no extra text) exactly in this shape:
{
  "title": string,
  "summary": string,
  "days": [
    {
      "day": number,
      "base": string,
      "transport": string[],
      "plan": string[],
      "food": string,
      "cost_usd": {
        "transport": number,
        "food": number,
        "hotel": number,
        "activities": number,
        "total": number
      }
    }
  ],
  "tips": string[]
}

Rules:
- Use ONLY locations within Sri Lanka. If user provided a non-Sri-Lanka place, replace it with a similar Sri Lanka destination.
- Optimize route order between cities if needed (still respect preferences).
- Keep it VERY short:
  - plan: max 2 items per day
  - transport: max 2 items per day
  - tips: max 3 items
  - summary: 1–2 sentences
- Costs are APPROX estimates in USD; keep numbers realistic and rounded.
- Keep the whole response compact (aim ~100–150 words worth of text inside JSON).
`;

    const prompt = `
Create a balanced Sri Lanka itinerary.

Selected cities (preference order):
${cities.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Trip length (days): ${days}
Travelers: ${travelers}
Style: ${style}

${schemaRules}
`;

    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt,
      temperature: 0.4,
      // This is what *actually* keeps output short:
      max_output_tokens: 240
    });

    const text = (resp.output_text || "").trim();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return new Response(JSON.stringify({ error: "Model returned invalid JSON. Please try again." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Minimal validation (avoid breaking your UI)
    if (!data || typeof data !== "object" || !Array.isArray(data.days)) {
      return new Response(JSON.stringify({ error: "Unexpected response format. Please try again." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const status = err?.status || err?.response?.status;

    if (status === 429) {
      return new Response(JSON.stringify({ error: "OpenAI quota/rate limit reached. Check billing/limits and try again." }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: `Server error: ${err?.message || "Unknown error"}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
