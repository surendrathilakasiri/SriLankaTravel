import OpenAI from "openai";

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min || i > max) return null;
  return i;
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

    const citiesRaw = body.cities;
    const travelers = clampInt(body.travelers, 1, 20);
    const days = clampInt(body.days, 1, 30);
    const style = String(body.style || "balanced").trim();

    if (!Array.isArray(citiesRaw) || citiesRaw.length === 0) {
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

    // Sanitize cities (allow custom, keep it sane)
    const cities = citiesRaw
      .map((c) => String(c || "").trim().replace(/\s+/g, " "))
      .filter(Boolean);

    if (!cities.length) {
      return new Response(JSON.stringify({ error: "Please select at least one city." }), {
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
Return ONLY valid JSON (no markdown, no extra text) in this exact shape:
{
  "title": string,
  "summary": string,
  "days": [
    {
      "day": number,
      "base": string,
      "transport": string[],
      "plan": string[],
      "food": string
    }
  ],
  "tips": string[]
  "cost": string[]
}
Rules:
- Use ONLY places within Sri Lanka.
- Optimize the route between selected cities (reorder if needed for realism).
- Allocate days logically across cities (more days for major hubs).
- 2–3 activities per day, realistic travel times.
- Mention train/bus/tuk-tuk/private car options where relevant.
- Include one local food suggestion per day.
- Costs are APPROX estimates in USD; keep numbers realistic and rounded.
- Keep the whole response compact .
`;

    const prompt = `
Create a Sri Lanka itinerary based on the user's selected cities.

Selected cities (user preference order):
${cities.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Trip length (days): ${days}
Travelers: ${travelers}
Style: ${style}

${schemaRules}
`;

    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt,
      temperature: 0.6
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

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const status = err?.status || err?.response?.status;

    if (status === 429) {
      return new Response(JSON.stringify({ error: "Maximun retry reached. Please try again later." }), {
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