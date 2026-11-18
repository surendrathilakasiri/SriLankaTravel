import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve('dist');
const files = [];
async function walk(dir) { for (const entry of await readdir(dir,{withFileTypes:true})) { const p=path.join(dir,entry.name); if(entry.isDirectory()) await walk(p); else files.push(p); } }
await walk(root);
let count=0;
for(const file of files) {
  if(/\.(pdf|env|md|mjs)$/i.test(file) || /\/(api|netlify|tests|node_modules)\//.test(file)) throw new Error(`Private/source file published: ${file}`);
  if(!file.endsWith('.html')) continue;
  const html=await readFile(file,'utf8');
  for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) if(!/src=|application\/ld\+json/.test(m[1])) new vm.Script(m[2],{filename:file});
  for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    let ref=m[1];
    if(/^(https?:|mailto:|tel:|data:|\$\{)/.test(ref) || ref.includes('${')) continue;
    const [withoutQuery] = ref.split('?');
    const [relative, anchor] = withoutQuery.split('#');
    const destination=relative ? path.resolve(root,relative.replace(/^\//,'')) : file;
    if(!destination.startsWith(root+path.sep) && destination!==root) throw new Error(`Escaping link: ${ref}`);
    try { await stat(destination); } catch { throw new Error(`Broken local link ${path.basename(file)} -> ${ref}`); }
    if(anchor && destination.endsWith('.html')) {
      const target=await readFile(destination,'utf8');
      if(!target.includes(`id="${anchor}"`) && !target.includes(`id='${anchor}'`)) throw new Error(`Missing anchor ${path.basename(file)} -> ${ref}`);
    }
  }
  count++;
}
console.log(`Checked ${count} pages: local links, anchors, script syntax and public-file boundaries.`);
