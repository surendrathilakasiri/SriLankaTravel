import { createHash, timingSafeEqual } from 'node:crypto';
export function isAdmin(request) {
  const expected = process.env.UPDATE_ADMIN_TOKEN;
  const provided = request.headers.get('x-admin-token');
  if (!expected || !provided) return false;
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(expected), hash(provided));
}
export function privateJson(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
