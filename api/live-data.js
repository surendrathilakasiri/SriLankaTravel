import { listApproved, usingSupabase } from "./_lib/liveDataStore.js";

export async function GET() {
  try {
    const items = await listApproved(50);
    return new Response(
      JSON.stringify({
        items,
        source: usingSupabase() ? "supabase" : "memory"
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: `Server error: ${err?.message || "Unknown"}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
