import { handler } from '../lib/itinerary.js';

export async function POST(request) {
  const body = await request.text();
  if (body.length > 16000) return Response.json({ error: 'Request too large.' }, { status: 413 });
  const result = await handler({ httpMethod: 'POST', body });
  return new Response(result.body, { status: result.statusCode, headers: result.headers });
}
