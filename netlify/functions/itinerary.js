// netlify/functions/itinerary.js
import OpenAI from "openai";

/**
 * Whitelist (because UI sends only these, but still validate server-side).
 * Add more cities anytime. Keep spelling consistent with index.html values.
 */
const VALID_CITIES = new Set([
  "Kandy",
  "Colombo",
  "Sigiriya",
  "Dambulla",
  "Anuradhapura",
  "Polonnaruwa",
  "Nuwara Eliya",
  "Ella",
  "Haputale",
  "Galle",
  "Unawatuna",
  "Mirissa",
  "Hikkaduwa",
  "Bentota",
  "Yala",
  "Udawalawe",
  "Trincomalee",
  "Jaffna",
  "Arugam Bay",
  "Negombo"
]);

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min || i > max) return null;
  return i;
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "OPENAI_API_KEY is missing in Netlify environment variables." })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const citiesRaw = body.cities;
    const travelers = clampInt(body.travelers, 1, 20);
    const days = clampInt(body.days, 1, 30);
    const style = String(body.style || "balanced").trim();

    if (!Array.isArray(citiesRaw) || citiesRaw.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Please select at least one city." })
      };
    }

    if (!travelers) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid travelers value (must be 1–20)." })
      };
    }

    if (!days) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid days value (must be 1–30)." })
      };
    }

    // Sanitize + validate cities
    const cities = citiesRaw
      .map((c) => String(c || "").trim())
      .filter(Boolean);

    if (cities.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Please select at least one city." })
      };
    }

    for (const c of cities) {
      if (!VALID_CITIES.has(c)) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: `Invalid city: ${c}. Please select cities from the list.` })
        };
      }
    }

    // Create OpenAI client at runtime (safer)
    const client = new OpenAI({ apiKey });

    // Force JSON-only output
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
}
Rules:
- Use ONLY places within Sri Lanka.
- Optimize the route between selected cities (reorder if needed for realism).
- Allocate days logically across cities (more days for major hubs).
- 2–4 activities per day, realistic travel times.
- Mention train/bus/tuk-tuk/private car options where relevant.
- Include one local food suggestion per day.
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
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Model returned invalid JSON. Please try again." })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (err) {
    const status = err?.status || err?.response?.status;

    if (status === 429) {
      return {
        statusCode: 429,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "OpenAI quota/rate limit reached. Check billing/limits and try again." })
      };
    }

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Server error: ${err.message}` })
    };
  }
};
