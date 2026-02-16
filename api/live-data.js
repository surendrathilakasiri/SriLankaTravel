import { listApproved, usingSupabase } from "./_lib/liveDataStore.js";

async function getLiveData() {
  const items = await listApproved(50);
  return {
    status: 200,
    payload: {
      items,
      source: usingSupabase() ? "supabase" : "memory"
    }
  };
}

function respond(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function GET() {
  try {
    const out = await getLiveData();
    return respond(out.status, out.payload);
  } catch (err) {
    return respond(500, { error: `Server error: ${err?.message || "Unknown"}` });
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const out = await getLiveData();
    return res.status(out.status).json(out.payload);
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err?.message || "Unknown"}` });
  }
}
