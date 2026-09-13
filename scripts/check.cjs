const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
function check(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, entry.name); if (entry.isDirectory()) check(f); else if (/\.(?:cjs|js)$/.test(f)) { const r = spawnSync(process.execPath, ['--check', f], { stdio: 'inherit' }); if (r.status !== 0) process.exit(1); } } }
for (const dir of ['src', 'scripts', 'tests']) check(dir);
console.log('All JavaScript syntax checks passed.');
