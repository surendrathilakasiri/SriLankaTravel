// Shared trip generation, invoked by the Vercel endpoint.
import OpenAI from "openai";
import { tripPreferences } from "./itinerary-input.js";

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
        body: JSON.stringify({ error: "The trip planner is temporarily unavailable. Please browse our suggested itineraries." })
      };
    }

    let body, preferences;
    try {
      body = JSON.parse(event.body || "{}");
      if (!body || typeof body !== "object") throw new Error("Invalid request.");
      preferences = tripPreferences(body);
    } catch (error) {
      return { statusCode: 400, headers: {"Content-Type":"application/json"}, body: JSON.stringify({error:error.message}) };
    }
    const citiesRaw = body.cities;
    const travelers = clampInt(body.travelers, 1, 20);
    const days = clampInt(body.days, 1, 30);
    const style = String(body.style || "balanced").trim();

    if (!Array.isArray(citiesRaw) || citiesRaw.length === 0 || citiesRaw.length > 12) {
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

    // Sanitize + validate cities (allow custom, but keep it sane)
    const cities = citiesRaw
      .map((c) => String(c || "").trim().replace(/\s+/g, " "))
      .filter(Boolean);

    if (cities.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Please select at least one city." })
      };
    }

    for (const c of cities) {
      if (c.length < 2 || c.length > 40) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: `Invalid city name: "${c}"` })
        };
      }
    }

    const client = new OpenAI({ apiKey, timeout: 25000, maxRetries: 0 });

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
- Begin at the arrival point; include transfer time and avoid packing long transfers with full activity days.
- Match the month, pace, interests and budget. Budget is USD per person per day, excluding international flights.
- When the route is too ambitious, suggest fewer stops in the summary rather than impossible travel times.
- Clearly call all prices and journey times planning estimates. Never claim live availability, verified prices, or confirmed bookings.
- Include a reminder to check official entry rules and transport schedules. Produce exactly the requested number of days.
`;

    const prompt = `
Create a Sri Lanka itinerary based on the user's selected cities.

Selected cities (user preference order):
${cities.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Trip length (days): ${days}
Travelers: ${travelers}
Style: ${style}
Planning preferences: ${JSON.stringify(preferences)}

${schemaRules}
`;

    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt,
      temperature: 0.6,
      max_output_tokens: 6000
    });

    const text = (resp.output_text || "").trim();

    let data;
    try {
      data = JSON.parse(text);
      if (!Array.isArray(data.days) || data.days.length !== days ||
          data.days.some(d => !d || !Array.isArray(d.plan) || typeof d.base !== "string")) {
        throw new Error("Incomplete itinerary");
      }
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
        body: JSON.stringify({ error: "The trip planner is busy. Please try again later or browse our suggested itineraries." })
      };
    }

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "We could not create a complete itinerary. Please try again or browse our suggested itineraries." })
    };
  }
};
