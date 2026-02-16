import { deleteUpdate, listPending, setStatus, usingSupabase } from "../_lib/liveDataStore.js";

function headerOf(requestOrReq, name) {
  if (!requestOrReq) return "";
  if (requestOrReq.headers?.get) return requestOrReq.headers.get(name) || "";
  return requestOrReq.headers?.[name.toLowerCase()] || requestOrReq.headers?.[name] || "";
}

function isAuthorized(requestOrReq) {
  const required = process.env.UPDATE_ADMIN_TOKEN;
  if (!required) return false;
  const token = headerOf(requestOrReq, "x-admin-token");
  return token === required;
}

function response(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function doGet() {
  const items = await listPending(200);
  return {
    status: 200,
    payload: { items, source: usingSupabase() ? "supabase" : "memory" }
  };
}

async function doPatch(body) {
  const id = String(body?.id || "").trim();
  const status = String(body?.status || "").trim();
  const reviewer = String(body?.reviewer || "admin").trim();

  if (!id) return { status: 400, payload: { error: "Missing update id" } };
  if (!["approved", "rejected"].includes(status)) {
    return { status: 400, payload: { error: "Invalid status" } };
  }

  const row = await setStatus({ id, status, reviewer });
  if (!row) return { status: 404, payload: { error: "Update not found" } };
  return { status: 200, payload: { ok: true, row } };
}

async function doDelete(body) {
  const id = String(body?.id || "").trim();
  if (!id) return { status: 400, payload: { error: "Missing update id" } };

  const removed = await deleteUpdate(id);
  if (!removed) return { status: 404, payload: { error: "Update not found" } };
  return { status: 200, payload: { ok: true, removedId: id } };
}

export async function GET(request) {
  try {
    if (!isAuthorized(request)) return response(401, { error: "Unauthorized" });
    const out = await doGet();
    return response(out.status, out.payload);
  } catch (err) {
    return response(500, { error: `Server error: ${err?.message || "Unknown"}` });
  }
}

export async function PATCH(request) {
  try {
    if (!isAuthorized(request)) return response(401, { error: "Unauthorized" });
    const body = await request.json().catch(() => ({}));
    const out = await doPatch(body);
    return response(out.status, out.payload);
  } catch (err) {
    return response(500, { error: `Server error: ${err?.message || "Unknown"}` });
  }
}

export async function DELETE(request) {
  try {
    if (!isAuthorized(request)) return response(401, { error: "Unauthorized" });
    const body = await request.json().catch(() => ({}));
    const out = await doDelete(body);
    return response(out.status, out.payload);
  } catch (err) {
    return response(500, { error: `Server error: ${err?.message || "Unknown"}` });
  }
}

export default async function handler(req, res) {
  try {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") {
      const out = await doGet();
      return res.status(out.status).json(out.payload);
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    if (req.method === "PATCH") {
      const out = await doPatch(body);
      return res.status(out.status).json(out.payload);
    }

    if (req.method === "DELETE") {
      const out = await doDelete(body);
      return res.status(out.status).json(out.payload);
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err?.message || "Unknown"}` });
  }
}
