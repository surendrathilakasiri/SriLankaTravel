import { readFile, mkdir, copyFile, rm, realpath } from 'node:fs/promises';
import path from 'node:path';

export const pages = ['index.html','destinations.html','experiences.html','itineraries.html','booking.html','contact.html','culture.html','food.html','practical.html','privacy.html','terms.html','my-trips.html','live-updates.html','submit-update.html','admin-updates.html','sigiriya.html','ella.html','galle.html','kandy.html','yala.html'];
const root = process.cwd();
const output = path.join(root, 'dist');
// dist is generated only; no source files or personal documents are removed.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const copied = new Set();
async function publish(file) {
  if (copied.has(file)) return;
  const allowed = pages.includes(file) || /^(assets|images)\/[\w./ -]+\.(css|js|jpe?g|png|webp|avif|svg|gif|woff2?)$/i.test(file);
  if (!allowed || file.split('/').includes('..')) throw new Error(`Unapproved public file: ${file}`);
  const source = path.join(root, file);
  if (!(await realpath(source)).startsWith(root + path.sep)) throw new Error(`External file: ${file}`);
  copied.add(file);
  await mkdir(path.dirname(path.join(output,file)), { recursive: true });
  await copyFile(source,path.join(output,file));
  if (!/\.(html|css|js)$/.test(file)) return;
  const text = await readFile(source,'utf8');
  const refs = new Set([...text.matchAll(/(?:["'(=])\/?((?:assets|images)\/[\w./ -]+\.(?:css|js|jpe?g|png|webp|avif|svg|gif|woff2?))/gi)].map(m=>m[1]));
  for (const ref of refs) await publish(ref);
}
for (const page of pages) await publish(page);
console.log(`Published ${copied.size} approved website files to dist; no PDFs, source APIs, tests, or credentials.`);
