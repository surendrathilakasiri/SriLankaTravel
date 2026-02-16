const DEFAULT_SOURCES = [
  {
    name: "Google News (Sri Lanka Travel)",
    type: "rss",
    url: "https://news.google.com/rss/search?q=Sri+Lanka+travel"
  },
  {
    name: "Google News (Sri Lanka events)",
    type: "rss",
    url: "https://news.google.com/rss/search?q=Sri+Lanka+events"
  }
];

const CITY_KEYWORDS = [
  "Colombo", "Kandy", "Galle", "Ella", "Nuwara Eliya", "Mirissa", "Jaffna",
  "Trincomalee", "Sigiriya", "Anuradhapura", "Polonnaruwa", "Negombo", "Bentota"
];

function cleanText(v) {
  return normalizeWhitespace(stripTags(decodeHtmlEntities(String(v || "").replace(/<!\[CDATA\[|\]\]>/g, ""))));
}

function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(text) {
  return String(text || "").replace(/<[^>]*>/g, " ");
}

function decodeHtmlEntities(text) {
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " "
  };

  return String(text || "")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => named[name] ?? match);
}

function cleanDescription(v) {
  // Google News descriptions often contain escaped HTML; decode first, then remove markup.
  return normalizeWhitespace(stripTags(decodeHtmlEntities(String(v || "").replace(/<!\[CDATA\[|\]\]>/g, ""))));
}

function getSources() {
  const raw = process.env.LIVE_FEED_SOURCES;
  if (!raw) return DEFAULT_SOURCES;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
    return DEFAULT_SOURCES;
  } catch {
    return DEFAULT_SOURCES;
  }
}

function detectCity(text) {
  const lower = text.toLowerCase();
  for (const city of CITY_KEYWORDS) {
    if (lower.includes(city.toLowerCase())) return city;
  }
  return "Sri Lanka";
}

function inferCategory(text) {
  const t = text.toLowerCase();
  if (/(festival|show|concert|event|celebration)/.test(t)) return "event";
  if (/(hotel|room|resort|accommodation|booking)/.test(t)) return "hotel-price";
  if (/(taxi|fare|uber|pickme|transport fee)/.test(t)) return "taxi-fee";
  return "place";
}

function extractTag(block, tagName) {
  const r = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const m = block.match(r);
  return m ? cleanText(m[1]) : "";
}

function parseRss(xml, sourceName) {
  const items = [];
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const raw of itemMatches.slice(0, 20)) {
    const title = extractTag(raw, "title");
    const details = cleanDescription(extractTag(raw, "description")) || title;
    const link = extractTag(raw, "link");
    const pubDate = extractTag(raw, "pubDate") || new Date().toISOString();
    const combined = `${title} ${details}`;

    if (!title) continue;

    items.push({
      id: `auto-${Buffer.from((sourceName + title).slice(0, 80)).toString("base64").replace(/=+$/g, "")}`,
      category: inferCategory(combined),
      city: detectCity(combined),
      title,
      details,
      price_info: "N/A",
      source_url: link,
      created_at: new Date(pubDate).toISOString(),
      feed_source: sourceName,
      auto_feed: true
    });
  }

  if (items.length) return items;

  // Atom fallback
  const entryMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const raw of entryMatches.slice(0, 20)) {
    const title = extractTag(raw, "title");
    const details = extractTag(raw, "summary") || extractTag(raw, "content") || title;
    const updated = extractTag(raw, "updated") || new Date().toISOString();
    const linkMatch = raw.match(/<link[^>]*href=["']([^"']+)["']/i);
    const link = linkMatch ? cleanText(linkMatch[1]) : "";
    const combined = `${title} ${details}`;

    if (!title) continue;

    items.push({
      id: `auto-${Buffer.from((sourceName + title).slice(0, 80)).toString("base64").replace(/=+$/g, "")}`,
      category: inferCategory(combined),
      city: detectCity(combined),
      title,
      details,
      price_info: "N/A",
      source_url: link,
      created_at: new Date(updated).toISOString(),
      feed_source: sourceName,
      auto_feed: true
    });
  }

  return items;
}

async function fetchSource(source) {
  const res = await fetch(source.url, {
    method: "GET",
    headers: {
      "User-Agent": "SriLankaTravelBot/1.0"
    }
  });

  if (!res.ok) throw new Error(`${source.name}: ${res.status}`);
  const text = await res.text();

  if (source.type === "rss" || /<rss|<feed/i.test(text)) {
    return parseRss(text, source.name);
  }

  return [];
}

async function getTrustedFeed() {
  const sources = getSources();
  const all = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        const rows = await fetchSource(source);
        all.push(...rows);
      } catch {
        // keep resilient; one source failing should not break feed
      }
    })
  );

  const dedup = new Map();
  for (const row of all) {
    const key = (row.source_url || row.title).toLowerCase();
    if (!dedup.has(key)) dedup.set(key, row);
  }

  return Array.from(dedup.values())
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 60);
}

export async function GET() {
  try {
    const items = await getTrustedFeed();
    return new Response(JSON.stringify({ items, source: "trusted-auto-feed" }), {
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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const items = await getTrustedFeed();
    return res.status(200).json({ items, source: "trusted-auto-feed" });
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err?.message || "Unknown"}` });
  }
}
