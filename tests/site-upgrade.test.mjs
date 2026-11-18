import test from 'node:test';
import assert from 'node:assert/strict';
import { tripPreferences } from '../netlify/lib/itinerary-input.js';
import { handler as live } from '../netlify/functions/live-data.js';
import { handler as submit } from '../netlify/functions/update-submissions.js';
import { handler as admin } from '../netlify/functions/admin-updates.js';
import { handler as news } from '../netlify/functions/trusted-feed.js';

test('planner preserves arrival, season, budget, pace and interests', () => {
 const input={arrival:'Colombo city',month:'August',budget:'Comfort: USD 80–160',pace:'Relaxed',style:'family',interests:['Food','Culture']};
 assert.deepEqual(tripPreferences(input),input);
 assert.throws(()=>tripPreferences({...input,month:'never'}),/month/);
 assert.throws(()=>tripPreferences({...input,interests:'Food'}),/interests/);
});
test('unconfigured community feed does not fabricate fresh updates or accept lost submissions', async () => {
 const old={...process.env}; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_ANON_KEY;
 try {
  const response=await live({httpMethod:'GET',headers:{}});
  assert.deepEqual(JSON.parse(response.body).items,[]);
  const result=await submit({httpMethod:'POST',headers:{},body:JSON.stringify({category:'place',city:'Kandy',title:'A useful update',details:'A full description of the update.',submitter_email:'test@example.com'})});
  assert.notEqual(result.statusCode,200);
  assert.match(JSON.parse(result.body).error,/temporarily unavailable/);
 } finally {process.env=old;}
});
test('Netlify adapter preserves authorization and rejects unsupported methods', async () => {
 const old=process.env.UPDATE_ADMIN_TOKEN; process.env.UPDATE_ADMIN_TOKEN='test-admin-token';
 try { assert.equal((await admin({httpMethod:'GET',headers:{}})).statusCode,401); assert.equal((await live({httpMethod:'POST',headers:{}})).statusCode,405); }
 finally {if(old===undefined) delete process.env.UPDATE_ADMIN_TOKEN; else process.env.UPDATE_ADMIN_TOKEN=old;}
});
test('news failures are visible and one working source remains usable', async t => {
 t.mock.method(globalThis,'fetch',async ()=>{throw new Error('offline')});
 assert.equal((await news({httpMethod:'GET',headers:{}})).statusCode,500);
 let calls=0;
 globalThis.fetch=async()=>{ if(calls++===0) throw new Error('offline'); return new Response(`<rss><channel><item><title>Travel transport update</title><link>https://example.com/update</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`); };
 const response=await news({httpMethod:'GET',headers:{}});
 assert.equal(response.statusCode,200); assert.equal(JSON.parse(response.body).items.length,1);
});
