import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { location, travelers, days, style } = JSON.parse(event.body || "{}");

    // Basic validation
    if (!location || !travelers || !days) {
      return { statusCode: 400, body: "Missing required fields: location, travelers, days" };
    }

    const travelersNum = Number(travelers);
    const daysNum = Number(days);

    if (!Number.isFinite(travelersNum) || travelersNum < 1 || travelersNum > 20) {
      return { statusCode: 400, body: "travelers must be between 1 and 20" };
    }
    if (!Number.isFinite(daysNum) || daysNum < 1 || daysNum > 30) {
      return { statusCode: 400, body: "days must be between 1 and 30" };
    }

    const schemaHint = `
Return ONLY valid JSON with this shape:
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
- Make it realistic for Sri Lanka driving times.
- Mix culture + nature + food.
- Include 2-4 activities per day.
- Avoid unsafe advice.
`;

    const prompt = `
Create a Sri Lanka travel itinerary.

Inputs:
- Starting location or focus area: ${location}
- Travelers: ${travelersNum}
- Trip length (days): ${daysNum}
- Style: ${style || "balanced"}

${schemaHint}
`;

    // OpenAI Responses API (recommended for new projects) :contentReference[oaicite:1]{index=1}
    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt,
      temperature: 0.6,
    });

    const text = resp.output_text?.trim() || "";
    // If model returns JSON as text, parse it:
    const json = JSON.parse(text);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    };
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
};
