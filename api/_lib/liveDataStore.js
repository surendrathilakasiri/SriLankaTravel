const MEMORY_KEY = "__community_updates_memory_store";

function getMemoryStore() {
  if (!globalThis[MEMORY_KEY]) {
    globalThis[MEMORY_KEY] = [
      {
        id: "seed-1",
        category: "event",
        city: "Kandy",
        title: "Evening cultural dance show schedule updated",
        details: "New 6:00 PM show slot at Kandy Lake Cultural Hall.",
        price_info: "Approx USD 10",
        event_start: null,
        event_end: null,
        source_url: "https://www.srilanka.travel",
        submitter_email: "",
        status: "approved",
        created_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: "system"
      }
    ];
  }
  return globalThis[MEMORY_KEY];
}

function nowIso() {
  return new Date().toISOString();
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function supabaseFetch(path, { method = "GET", body, prefer } = {}) {
  const cfg = supabaseConfig();
  if (!cfg) return null;

  const headers = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`
  };

  if (body) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Supabase error ${res.status}: ${txt || "unknown"}`);
  }

  if (res.status === 204) return [];
  return res.json().catch(() => []);
}

export async function listApproved(limit = 30) {
  const cfg = supabaseConfig();
  if (cfg) {
    return supabaseFetch(
      `community_updates?status=eq.approved&order=created_at.desc&limit=${Number(limit)}`
    );
  }

  return getMemoryStore()
    .filter((r) => r.status === "approved")
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);
}

export async function listPending(limit = 100) {
  const cfg = supabaseConfig();
  if (cfg) {
    return supabaseFetch(
      `community_updates?status=eq.pending&order=created_at.asc&limit=${Number(limit)}`
    );
  }

  return getMemoryStore()
    .filter((r) => r.status === "pending")
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .slice(0, limit);
}

export async function createPending(input) {
  const payload = {
    category: input.category,
    city: input.city,
    title: input.title,
    details: input.details,
    price_info: input.price_info,
    event_start: input.event_start,
    event_end: input.event_end,
    source_url: input.source_url,
    submitter_email: input.submitter_email,
    status: "pending",
    created_at: nowIso()
  };

  const cfg = supabaseConfig();
  if (cfg) {
    const rows = await supabaseFetch("community_updates", {
      method: "POST",
      body: payload,
      prefer: "return=representation"
    });
    return rows[0] || null;
  }

  const store = getMemoryStore();
  const row = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...payload,
    reviewed_at: null,
    reviewed_by: null
  };
  store.push(row);
  return row;
}

export async function setStatus({ id, status, reviewer }) {
  const safeStatus = status === "approved" ? "approved" : "rejected";
  const reviewedAt = nowIso();

  const cfg = supabaseConfig();
  if (cfg) {
    const rows = await supabaseFetch(
      `community_updates?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: {
          status: safeStatus,
          reviewed_at: reviewedAt,
          reviewed_by: reviewer || "admin"
        },
        prefer: "return=representation"
      }
    );
    return rows[0] || null;
  }

  const store = getMemoryStore();
  const row = store.find((r) => String(r.id) === String(id));
  if (!row) return null;
  row.status = safeStatus;
  row.reviewed_at = reviewedAt;
  row.reviewed_by = reviewer || "admin";
  return row;
}

export async function deleteUpdate(id) {
  const cfg = supabaseConfig();
  if (cfg) {
    const rows = await supabaseFetch(
      `community_updates?id=eq.${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        prefer: "return=representation"
      }
    );
    return rows[0] || null;
  }

  const store = getMemoryStore();
  const idx = store.findIndex((r) => String(r.id) === String(id));
  if (idx === -1) return null;
  const [removed] = store.splice(idx, 1);
  return removed || null;
}

export function usingSupabase() {
  return Boolean(supabaseConfig());
}
