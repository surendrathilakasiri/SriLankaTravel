import { records, recordId, storageConfigured } from './records.js';

export function createUpdateStore(store = records) {
  async function matching(status, limit) {
    if (!storageConfigured()) return [];
    let cursor;
    const items = [];
    do {
      const page = await store.page('updates', { cursor, limit: 50 });
      items.push(...page.items.filter(row => row.status === status));
      cursor = page.cursor;
    } while (cursor && items.length < limit);
    return items.slice(0, limit);
  }
  return {
    async listApproved(limit = 50) {
      const rows = await matching('approved', limit);
      // Allowlist public fields: never expose a contributor's email or review metadata.
      return rows.map(row => Object.fromEntries(['id','category','city','title','details','price_info','event_start','event_end','source_url','created_at'].map(key => [key, row[key]])));
    },
    listPending: (limit = 200) => matching('pending', limit),
    async createPending(input) {
      if (!storageConfigured()) throw new Error('Community submissions are temporarily unavailable. Please use the contact page.');
      const row = { ...input, id: recordId(), status: 'pending', created_at: new Date().toISOString() };
      await store.save('updates', row);
      return row;
    },
    async setStatus({ id, status, reviewer }) {
      const saved = await store.read('updates', id);
      if (!saved) return null;
      const row = { ...saved.record, status, reviewed_at: new Date().toISOString(), reviewed_by: reviewer || 'admin' };
      await store.save('updates', row, { overwrite: true, etag: saved.etag });
      return row;
    },
    async deleteUpdate(id) {
      // A soft delete removes the item from public and moderation feeds but keeps recovery possible.
      return this.setStatus({ id, status: 'deleted', reviewer: 'admin' });
    }
  };
}
const updates = createUpdateStore();
export const listApproved = (...args) => updates.listApproved(...args);
export const listPending = (...args) => updates.listPending(...args);
export const createPending = (...args) => updates.createPending(...args);
export const setStatus = (...args) => updates.setStatus(...args);
export const deleteUpdate = (...args) => updates.deleteUpdate(...args);
