// api/itinerary.js  (Vercel Function, OpenAI SDK v5)
import OpenAI from "openai";

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min || i > max) return null;
  return i;
}

function normalizeCities(citiesRaw) {
  const cleaned = (Array.isArray(citiesRaw) ? citiesRaw : [])
    .map((c) => String(c || "").trim().replace(/\s+/g, " "))
    .filter(Boolean);

  // dedupe (case-insensitive) while preserving order
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

    for (const c of cities) {
      if (c.length < 2 || c.length > 40) {
        return new Response(JSON.stringify({ error: `Invalid city name: "${c}"` }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const client = new OpenAI({ apiKey });

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
- Use ONLY locations within Sri Lanka.
- Optimize route order between cities if needed.
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

    // ✅ Responses API (v5): use text.format, NOT response_format
    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.6,
      max_output_tokens: 240,

      text: {
        format: { type: "json_object" }
      },

      input: [
        {
          role: "system",
          content:
            "Return ONLY valid JSON. No markdown. No commentary. No trailing commas."
        },
        { role: "user", content: prompt }
      ]
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
