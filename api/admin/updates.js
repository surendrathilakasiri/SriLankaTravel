import { listPending, setStatus, usingSupabase } from "../_lib/liveDataStore.js";

function isAuthorized(request) {
  const required = process.env.UPDATE_ADMIN_TOKEN;
  if (!required) return false;
  const token = request.headers.get("x-admin-token") || "";
  return token === required;
}

export async function GET(request) {
  try {
    if (!isAuthorized(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const items = await listPending(200);
    return new Response(JSON.stringify({ items, source: usingSupabase() ? "supabase" : "memory" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Server error: ${err?.message || "Unknown"}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function PATCH(request) {
  try {
    if (!isAuthorized(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    const status = String(body.status || "").trim();
    const reviewer = String(body.reviewer || "admin").trim();

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing update id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!["approved", "rejected"].includes(status)) {
      return new Response(JSON.stringify({ error: "Invalid status" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const row = await setStatus({ id, status, reviewer });
    if (!row) {
      return new Response(JSON.stringify({ error: "Update not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true, row }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Server error: ${err?.message || "Unknown"}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
