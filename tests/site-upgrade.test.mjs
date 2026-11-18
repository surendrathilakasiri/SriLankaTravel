import test from 'node:test';
import assert from 'node:assert/strict';
import { tripPreferences } from '../lib/itinerary-input.js';
import { GET as live } from '../api/live-data.js';
import { POST as submit } from '../api/update-submissions.js';
import { GET as admin } from '../api/admin/updates.js';
import { GET as news } from '../api/trusted-feed.js';
import { createUpdateStore } from '../lib/live-data-store.js';
import { createRecordStore } from '../lib/records.js';

test('planner preserves arrival, season, budget, pace and interests', () => {
 const input={arrival:'Colombo city',month:'August',budget:'Comfort: USD 80–160',pace:'Relaxed',style:'family',interests:['Food','Culture']};
 assert.deepEqual(tripPreferences(input),input);
 assert.throws(()=>tripPreferences({...input,month:'never'}),/month/);
 assert.throws(()=>tripPreferences({...input,interests:'Food'}),/interests/);
});
test('unconfigured community feed does not fabricate fresh updates or accept lost submissions', async () => {
 const old={...process.env}; delete process.env.BLOB_STORE_ID; delete process.env.BLOB_READ_WRITE_TOKEN;
 try {
  assert.deepEqual((await (await live()).json()).items,[]);
  const result=await submit(new Request('https://example.com/api/update-submissions',{method:'POST',body:JSON.stringify({category:'place',city:'Kandy',title:'A useful update',details:'A full description of the update.',submitter_email:'test@example.com'})}));
  assert.notEqual(result.status,200);
 } finally {process.env=old;}
});
test('moderation requires authorization', async () => {
 assert.equal((await admin(new Request('https://example.com/api/admin/updates'))).status,401);
});
test('news failures are visible and one working source remains usable', async t => {
 t.mock.method(globalThis,'fetch',async ()=>{throw new Error('offline')});
 assert.equal((await news()).status,500);
 let calls=0;
 globalThis.fetch=async()=>{ if(calls++===0) throw new Error('offline'); return new Response(`<rss><channel><item><title>Travel transport update</title><link>https://example.com/update</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`); };
 const response=await news();
 assert.equal(response.status,200); assert.equal((await response.json()).items.length,1);
});
test('approved community feed omits private fields and unapproved records', async () => {
 const old=process.env.BLOB_STORE_ID; process.env.BLOB_STORE_ID='test-store';
 try {
  const store=createUpdateStore({ page: async()=>({items:[{id:'1',status:'approved',title:'Public',submitter_email:'private@example.com',reviewed_by:'private'},{id:'2',status:'pending',title:'Not public'}],cursor:null}) });
  const items=await store.listApproved();
  assert.equal(items.length,1); assert.equal(items[0].title,'Public');
  assert.equal('submitter_email' in items[0],false); assert.equal('reviewed_by' in items[0],false);
 } finally {if(old===undefined) delete process.env.BLOB_STORE_ID; else process.env.BLOB_STORE_ID=old;}
});
test('record storage uses private access and rejects path traversal', async () => {
 let options;
 const store=createRecordStore({put:async(path,content,opts)=>{options=opts;}});
 await store.save('contacts',{id:'123',message:'private'});
 assert.equal(options.access,'private'); assert.equal(options.allowOverwrite,false);
 await assert.rejects(()=>store.save('contacts',{id:'../updates/123'}),/Invalid/);
});
