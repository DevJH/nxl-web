// Refresh local asset URLs after edits so existing browser caches stay in sync.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pages = ['index.html', 'download.html', 'studio/index.html', 'guide.html', 'manual.html', 'studio-manual.html', 'updates.html'];
for (const page of pages) {
  const file = path.join(root, page);
  const original = fs.readFileSync(file, 'utf8');
  const updated = original.replace(/((?:src|href|data-light-src|data-dark-src)=")([^"?]+\.(?:css|js|png|jpe?g|webp|svg))(?:\?[^"\s]*)?"/g, (match, attribute, asset) => {
    if (/^(?:[a-z]+:|\/\/)/i.test(asset)) return match;
    const file = path.resolve(root, asset.startsWith('/') ? asset.slice(1) : path.join(path.dirname(page), asset));
    const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
    return `${attribute}${asset}?v=${hash}"`;
  });
  if (updated !== original) fs.writeFileSync(file, updated);
}
console.log(`Updated CSS/JS/image versions in ${pages.length} pages.`);
