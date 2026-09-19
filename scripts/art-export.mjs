// Bundles the art catalog into one self-contained HTML file: every SVG inlined as a data URI,
// nothing fetched. Drop it on a phone, open it from Files or a mail attachment, browse offline.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('public/art');
const out = process.argv[2] ?? 'art-directory.html';
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const cache = new Map();
function dataUri(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing asset referenced by the catalog: ${rel}`);
  const svg = fs.readFileSync(full, 'utf8').replace(/\s+/g, ' ').trim();
  // Percent-encoding keeps SVG far smaller than base64 and stays valid inside a quoted attribute.
  const uri = 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27');
  cache.set(rel, uri);
  return uri;
}

let inlined = 0;
// 1. The card previews, which are plain <img src="..."> in the generated markup.
let html = page.replace(/src="((?:characters|enemies|locations|maps|story|ui)\/[^"]+\.svg)"/g, (_, rel) => {
  inlined++;
  return `src="${dataUri(rel)}"`;
});

// 2. The detail dialog builds its images from the entry data, so the paths in that JSON are
//    swapped for data URIs too. The file list keeps the real path as its label.
const marker = 'const entries=';
const start = html.indexOf(marker) + marker.length;
const end = html.indexOf(';\nconst byId', start);
const entries = JSON.parse(html.slice(start, end));
for (const e of entries) {
  e.paths = { ...e.files };
  for (const [role, rel] of Object.entries(e.files)) { e.files[role] = dataUri(rel); inlined++; }
}
html = html.slice(0, start) + JSON.stringify(entries).replaceAll('<', '\\u003c') + html.slice(end);
// The links in the detail panel point at files that no longer exist beside this page.
html = html.replace("a.href=file;a.textContent=role+' → '+file;a.target='_blank';row.append(a);",
  "row.textContent=role+' → '+(e.paths?.[role]??role);void a;");
// Say what this copy is, right at the top.
html = html.replace('<a href="ART_GUIDE.md">Read the art-to-design guide</a> · <a href="catalog.json">Asset manifest</a>',
  'offline copy, self-contained, no network needed');
html = html.replace('<title>Provenance · Art Library</title>', '<title>Provenance · Art Library (offline)</title>');

fs.writeFileSync(out, html);
const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(2);
console.log(`Wrote ${out}: ${entries.length} entries, ${cache.size} SVGs inlined (${inlined} references), ${mb} MB, no external requests.`);
