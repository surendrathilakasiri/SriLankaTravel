const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function getStore() {
  if (!globalThis.__contactRateStore) globalThis.__contactRateStore = new Map();
  return globalThis.__contactRateStore;
}

function getClientIp(headers) {
  const forwarded = headers["x-forwarded-for"] || "";
  const first = forwarded.split(",")[0].trim();
  return first || headers["x-real-ip"] || "unknown";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hasSuspiciousContent(message) {
  const text = String(message || "");
  const urlCount = (text.match(/https?:\/\//gi) || []).length;
  return urlCount > 3;
}

function rateLimit(ip) {
  const store = getStore();
  const now = Date.now();
  const record = store.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > record.resetAt) {
    store.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false };
  }

  record.count += 1;
  store.set(ip, record);
  return { allowed: true };
}

async function forwardToCrm(payload) {
  const crmUrl = process.env.CRM_WEBHOOK_URL;
  if (!crmUrl) return { ok: true, skipped: true };

  const res = await fetch(crmUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return { ok: res.ok, status: res.status };
}

async function sendViaResend({ to, from, subject, text, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo ? [replyTo] : undefined,
      subject,
      text
    })
  });
  return { ok: res.ok, status: res.status };
}

async function sendViaFormSubmit({ to, subject, name, email, topic, message, source }) {
  const endpoint = `https://formsubmit.co/ajax/${encodeURIComponent(to)}`;
  const formData = new FormData();
  formData.append("name", name);
  formData.append("email", email);
  formData.append("topic", topic);
  formData.append("message", message);
  formData.append("source", source || "contact-page");
  formData.append("_subject", subject);
  formData.append("_captcha", "false");

  const res = await fetch(endpoint, {
    method: "POST",
    body: formData
  });
  return { ok: res.ok, status: res.status };
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });

    const ip = getClientIp(event.headers || {});
    const rl = rateLimit(ip);
    if (!rl.allowed) return response(429, { error: "Too many submissions. Please try again later." });

    const body = JSON.parse(event.body || "{}");
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const topic = String(body.topic || "General inquiry").trim();
    const message = String(body.message || "").trim();
    const source = String(body.source || "contact-page").trim();
    const honey = String(body._honey || "").trim();

    if (honey) return response(200, { ok: true });

    if (!name || name.length < 2 || name.length > 80) {
      return response(400, { error: "Please provide a valid name." });
    }
    if (!isValidEmail(email)) {
      return response(400, { error: "Please provide a valid email." });
    }
    if (!message || message.length < 15 || message.length > 4000) {
      return response(400, { error: "Message must be 15-4000 characters." });
    }
    if (hasSuspiciousContent(message)) {
      return response(400, { error: "Please reduce links in your message." });
    }

    const toEmail = process.env.CONTACT_TO_EMAIL || "surendrakoththigoda@gmail.com";
    const fromEmail =
      process.env.CONTACT_FROM_EMAIL || "Sri Lanka Travel <onboarding@resend.dev>";
    const subject = `New website contact: ${topic}`;
    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Topic: ${topic}`,
      `Source: ${source}`,
      "",
      "Message:",
      message
    ].join("\n");

    await forwardToCrm({ name, email, topic, message, source, ip });

    let sendResult = await sendViaResend({
      to: toEmail,
      from: fromEmail,
      subject,
      text,
      replyTo: email
    });

    if (!sendResult.ok) {
      sendResult = await sendViaFormSubmit({
        to: toEmail,
        subject,
        name,
        email,
        topic,
        message,
        source
      });
    }

    if (!sendResult.ok) {
      return response(502, { error: "Could not deliver message. Please try again shortly." });
    }

    if (process.env.CONTACT_AUTO_REPLY === "true") {
      await sendViaResend({
        to: email,
        from: fromEmail,
        subject: "We received your Sri Lanka Travel request",
        text:
          "Thank you for contacting Sri Lanka Travel. We received your request and will reply within 24 hours."
      });
    }

    return response(200, { ok: true });
  } catch (err) {
    return response(500, { error: `Server error: ${err?.message || "Unknown error"}` });
  }
};
