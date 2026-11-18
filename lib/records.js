import * as blob from '@vercel/blob';
import { randomUUID } from 'node:crypto';

export function storageConfigured() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}
export function recordId() {
  // Lexicographic order puts the newest records first in Blob listings.
  return `${9999999999999 - Date.now()}-${randomUUID()}`;
}
function pathname(collection, id) {
  if (!['contacts', 'updates'].includes(collection) || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new Error('Invalid record.');
  return `${collection}/${id}.json`;
}
export function createRecordStore(client = blob) {
  return {
    async save(collection, record, { overwrite = false, etag } = {}) {
      return client.put(pathname(collection, record.id), JSON.stringify(record), {
        access: 'private', addRandomSuffix: false, contentType: 'application/json',
        allowOverwrite: overwrite, ...(etag ? { ifMatch: etag } : {}),
        abortSignal: AbortSignal.timeout(10000)
      });
    },
    async read(collection, id) {
      const result = await client.get(pathname(collection, id), {
        access: 'private', useCache: false, abortSignal: AbortSignal.timeout(10000)
      });
      if (!result) return null;
      return { record: await new Response(result.stream).json(), etag: result.blob.etag };
    },
    async page(collection, { cursor, limit = 20 } = {}) {
      if (!['contacts','updates'].includes(collection)) throw new Error('Invalid collection.');
      const page = await client.list({ prefix: `${collection}/`, cursor, limit, abortSignal: AbortSignal.timeout(10000) });
      const items = [];
      // Bound concurrency to avoid a large burst of storage reads.
      for (let i = 0; i < page.blobs.length; i += 10) {
        const rows = await Promise.all(page.blobs.slice(i, i + 10).map(async b => {
          const result = await client.get(b.pathname, { access: 'private', useCache: false, abortSignal: AbortSignal.timeout(10000) });
          return result ? new Response(result.stream).json() : null;
        }));
        items.push(...rows.filter(Boolean));
      }
      return { items, cursor: page.hasMore ? page.cursor : null };
    }
  };
}
export const records = createRecordStore();
