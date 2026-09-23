// Read-only validation for the static site. No build, publish, or network writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pages = ['index.html', 'download.html', 'studio/index.html', 'guide.html', 'manual.html', 'studio-manual.html', 'updates.html'];
const errors = [];
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
let checked = 0;
for (const name of pages) {
  const html = read(name);
  const pageIds = ids(html);
  const duplicateIds = pageIds.filter((id, index) => pageIds.indexOf(id) !== index);
  if (duplicateIds.length) errors.push(`${name}: duplicate ids: ${duplicateIds.join(', ')}`);
  if ((html.match(/<h1(?:\s|>)/g) || []).length !== 1) errors.push(`${name}: expected one h1`);
  if ((html.match(/<main(?:\s|>)/g) || []).length !== 1) errors.push(`${name}: expected one main`);
  for (const asset of ['/assets/theme.js', '/assets/site.css', '/assets/site.js']) {
    if (!html.includes(asset)) errors.push(`${name}: missing shared asset ${asset}`);
  }
  for (const [, asset, version] of html.matchAll(/(?:href|src|data-light-src|data-dark-src)="([^"?]+\.(?:css|js|png|jpe?g|webp|svg))(?:\?v=([^"\s]+))?"/g)) {
    if (/^(?:[a-z]+:|\/\/)/i.test(asset)) continue;
    const file = path.resolve(root, asset.startsWith('/') ? asset.slice(1) : path.join(path.dirname(name), asset));
    if (!fs.existsSync(file)) continue;
    const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
    if (version !== hash) errors.push(`${name}: stale asset version for ${asset}; run node scripts/version-assets.mjs`);
  }
  for (const match of html.matchAll(/(?:href|src|data-light-src|data-dark-src)="([^"]+)"/g)) {
    const href = match[1];
    if (/^(?:[a-z]+:|\/\/)/i.test(href)) continue;
    const [file, fragment] = href.split('#');
    const rel = file.startsWith('/') ? file.slice(1) : path.join(path.dirname(name), file || path.basename(name));
    let target = path.resolve(root, rel.split('?')[0]);
    if (!target.startsWith(root + path.sep) && target !== root) { errors.push(`${name}: path escapes site: ${href}`); continue; }
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) { errors.push(`${name}: missing target ${href}`); continue; }
    if (fragment && target.endsWith('.html') && !ids(fs.readFileSync(target, 'utf8')).includes(decodeURIComponent(fragment))) errors.push(`${name}: missing anchor ${href}`);
    checked++;
  }
}
for (const screen of ['design', 'spec', 'flow', 'prototype', 'dev', 'plan', 'tools']) {
  for (const theme of ['light', 'dark']) {
    if (!fs.existsSync(path.join(root, `images/studio-current/${screen}-${theme}.jpg`))) errors.push(`Missing ${screen}-${theme} screenshot`);
  }
}
const builder = JSON.parse(read('release-manifest.json')).releases?.[0];
const studio = JSON.parse(read('studio/version.json'));
assert.match(builder.version, /^\d+\.\d+\.\d+/);
assert.match(studio.version, /^\d+\.\d+\.\d+/);
if (!fs.existsSync(path.join(root, builder.vsix.path))) errors.push(`Missing Builder artifact: ${builder.vsix.path}`);
for (const [platform, file] of Object.entries(studio.platforms)) {
  const url = new URL(file.url);
  if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/DevJH/nxl-web/releases/download/')) errors.push(`Unexpected download origin: ${platform}`);
  if (!url.pathname.includes(`/studio-v${studio.version}/`)) errors.push(`Download version mismatch: ${platform}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${pages.length} pages, ${checked} local links/assets, versioned CSS/JS/images, 14 Studio screenshots, and release metadata.`);
}
