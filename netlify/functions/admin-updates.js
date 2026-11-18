import * as endpoint from "../../api/admin/updates.js";
export const handler = async (event) => {
  const method = event.httpMethod;
  if (typeof endpoint[method] !== "function") return { statusCode: 405, body: JSON.stringify({error:"Method not allowed"}) };
  const request = new Request("https://local.invalid" + (event.path || "/"), {
    method, headers: event.headers,
    ...(method !== "GET" && method !== "HEAD" ? { body: event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString() : event.body } : {})
  });
  const response = await endpoint[method](request);
  return { statusCode: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
};
