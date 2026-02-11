import OpenAI from "openai";
import { getStore } from "@netlify/blobs";
import crypto from "crypto";

function stableStringify(obj) {
  // Ensures consistent order so hash stays the same
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function makeKey(payload) {
  const normalized = {
    location: String(payload.location || "").trim().toLowerCase(),
    travelers: Number(payload.travelers),
    days: Number(payload.days),
    style: String(payload.style || "balanced").trim().toLowerCase(),
  };

  const hash = crypto.createHash("sha256").update(stableStringify(normalized)).digest("hex");
  return { key: `itinerary:${hash}`, normalized };
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "OPENAI_API_KEY missing in Netlify environment variables." };
    }

    const payload = JSON.parse(event.body || "{}");
    const { key, normalized } = makeKey(payload);

    // 1) Open the blob store
    // Store name can be anything; keep it consistent
    const store = getStore("itineraries");

    // 2) Try cache first
    const cached = await store.get(key, { type: "json" });
    if (cached) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
        body: JSON.stringify(cached),
      };
    }

    // 3) Generate using OpenAI (cache MISS)
    const client = new OpenAI({ apiKey });

    const schemaRules = `
Return ONLY valid JSON (no markdown, no extra text) in this exact shape:
{
  "title": string,
  "summary": string,
  "days": [
    { "day": number, "base": string, "transport": string[], "plan": string[], "food": string }
  ],
  "tips": string[]
}
`;

    const prompt = `
Create a Sri Lanka itinerary.
Starting location/focus area: ${normalized.location}
Travelers: ${normalized.travelers}
Trip length (days): ${normalized.days}
Style: ${normalized.style}

${schemaRules}
`;

    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt,
      temperature: 0.6,
    });

    const text = (resp.output_text || "").trim();
    const data = JSON.parse(text);

    // 4) Save result to Blobs (persistent)
    // Add simple metadata so you can clean old entries later if needed
    await store.setJSON(key, data, {
      metadata: {
        createdAt: new Date().toISOString(),
        normalized,
      },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "X-Cache": "MISS" },
      body: JSON.stringify(data),
    };

  } catch (err) {
    const status = err?.status || err?.response?.status;

    // Cleaner message for quota
    if (status === 429) {
      return {
        statusCode: 429,
        body: "OpenAI quota/rate limit. Check billing/limits or reduce requests.",
      };
    }
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
