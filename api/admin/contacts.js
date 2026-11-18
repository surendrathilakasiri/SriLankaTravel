import { isAdmin, privateJson } from '../../lib/admin.js';
import { records } from '../../lib/records.js';
export async function GET(request) {
  if (!isAdmin(request)) return privateJson({ error: 'Unauthorized' }, 401);
  try {
    const cursor = new URL(request.url).searchParams.get('cursor') || undefined;
    const page = await records.page('contacts', { cursor });
    return privateJson(page);
  } catch { return privateJson({ error: 'Unable to load messages. Please try again.' }, 503); }
}
