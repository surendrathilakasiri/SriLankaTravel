import { listApproved } from "../lib/live-data-store.js";

async function getLiveData() {
  const items = await listApproved(50);
  return {
    status: 200,
    payload: {
      items,
      source: "vercel-blob"
    }
  };
}

function respond(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=0, s-maxage=30" }
  });
}

export async function GET() {
  try {
    const out = await getLiveData();
    return respond(out.status, out.payload);
  } catch (err) {
    return respond(500, { error: "Travel updates are temporarily unavailable. Please try again shortly." });
  }
}
