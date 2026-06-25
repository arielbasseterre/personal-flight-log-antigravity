const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist');
const swPath = path.join(distPath, 'sw.js');
if (!fs.existsSync(swPath)) {
  console.error('[sw-version] dist/sw.js not found — skipping');
  process.exit(0);
}

const now = new Date();
const ts = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}Z`;

let content = fs.readFileSync(swPath, 'utf8');

if (content.startsWith('// build:')) {
  content = content.replace(/^\/\/ build: .+\n/, '');
}

fs.writeFileSync(swPath, `// build: ${ts}\n${content}`);
fs.writeFileSync(path.join(distPath, 'sw-version.json'), JSON.stringify({ version: ts }));
console.log(`[sw-version] Injected build ${ts} into dist/sw.js`);
