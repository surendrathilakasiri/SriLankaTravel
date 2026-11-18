import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../live-updates.html', import.meta.url), 'utf8');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'))
  .replace('    loadUpdates();', '').replace('    setInterval(loadUpdates, 60000);', '');
function page(fetch) {
  const elements = new Map();
  const context = vm.createContext({ fetch, AbortController, setTimeout, clearTimeout,
    window: {}, document: {
      querySelector: () => null,
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { classList: { toggle() {} }, setAttribute() {}, addEventListener() {} });
        return elements.get(id);
      }
    }
  });
  vm.runInContext(script, context);
  return { run: code => vm.runInContext(code, context), elements };
}
const item = { title: 'Working feed', created_at: '2026-11-17', details: 'Update' };
const success = () => ({ ok: true, json: async () => ({ items: [item] }) });

test('community HTTP failure does not hide automatic articles', async () => {
  const p = page(async url => url.includes('trusted') ? success() : { ok: false });
  await p.run('loadUpdates()');
  assert.match(p.elements.get('liveGrid').innerHTML, /Working feed/);
  p.run('setTab("manual"); renderByTab()');
  assert.match(p.elements.get('sourceMeta').textContent, /temporarily unavailable/);
});

test('network failure preserves previous articles and recovers next refresh', async () => {
  let fail = false;
  const p = page(async () => { if (fail) throw new TypeError('fetch failed'); return success(); });
  await p.run('loadUpdates()');
  fail = true;
  await p.run('loadUpdates()');
  assert.match(p.elements.get('liveGrid').innerHTML, /Working feed/);
  assert.match(p.elements.get('sourceMeta').textContent, /previously loaded/);
  fail = false;
  await p.run('loadUpdates()');
  assert.doesNotMatch(p.elements.get('sourceMeta').textContent, /unavailable/);
});

test('automatic feed failure leaves community feed usable', async () => {
  const p = page(async url => { if (url.includes('trusted')) throw new Error('offline'); return success(); });
  await p.run('loadUpdates()');
  p.run('setTab("manual"); renderByTab()');
  assert.match(p.elements.get('liveGrid').innerHTML, /Working feed/);
  assert.match(p.elements.get('sourceMeta').textContent, /Community manual: 1/);
});
