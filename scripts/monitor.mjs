// Read-only smoke checks: no emails, form submissions, or paid AI requests.
const origin = process.env.SITE_URL || 'https://www.srilankatravelers.com';
const checks = [
 ['/index.html', text=>text.includes('name="arrival"') && text.includes('name="budget"')],
 ['/contact.html', text=>text.includes('name="form-name"') && text.includes('value="contact"')],
 ['/sigiriya.html', text=>text.includes('Sources and checks')],
 ['/api/live-data', text=>Array.isArray(JSON.parse(text).items)],
 ['/api/trusted-feed', text=>Array.isArray(JSON.parse(text).items)]
];
let failed=false;
await Promise.all(checks.map(async ([route,validate])=>{
 try {
  const response=await fetch(origin+route,{signal:AbortSignal.timeout(20000)});
  const text=await response.text();
  if(!response.ok || !validate(text)) throw new Error(`Unexpected response (${response.status})`);
  console.log(`PASS ${route}`);
 } catch(error) { failed=true; console.error(`FAIL ${route}: ${error.message}`); }
}));
// An invalid itinerary request must be rejected by the real endpoint, without calling the model.
try {
 const response=await fetch(origin+'/api/itinerary',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"cities":[],"days":7,"travelers":2}',signal:AbortSignal.timeout(10000)});
 if(response.status!==400) throw new Error(`Expected validation error, got ${response.status}`);
 console.log('PASS itinerary route and configuration');
} catch(error) { failed=true; console.error(`FAIL itinerary: ${error.message}`); }
if(failed) process.exitCode=1;
