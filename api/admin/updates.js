import { deleteUpdate, listPending, setStatus } from "../../lib/live-data-store.js";

import { isAdmin as isAuthorized } from "../../lib/admin.js";

function response(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" }
  });
}

async function doGet() {
  const items = await listPending(200);
  return {
    status: 200,
    payload: { items, source: "vercel-blob" }
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
    return response(500, { error: "Travel updates are temporarily unavailable. Please try again shortly." });
  }
}

export async function PATCH(request) {
  try {
    if (!isAuthorized(request)) return response(401, { error: "Unauthorized" });
    const body = await request.json().catch(() => ({}));
    const out = await doPatch(body);
    return response(out.status, out.payload);
  } catch (err) {
    return response(500, { error: "Travel updates are temporarily unavailable. Please try again shortly." });
  }
}

export async function DELETE(request) {
  try {
    if (!isAuthorized(request)) return response(401, { error: "Unauthorized" });
    const body = await request.json().catch(() => ({}));
    const out = await doDelete(body);
    return response(out.status, out.payload);
  } catch (err) {
    return response(500, { error: "Travel updates are temporarily unavailable. Please try again shortly." });
  }
}
