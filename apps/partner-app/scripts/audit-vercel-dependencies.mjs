import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Usage: node scripts/audit-vercel-dependencies.mjs [--enforce]
// --enforce is intended for the final zero-Vercel production release gate.
// Until all workflows are migrated, running without it reports actionable blockers.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = ['app', 'lib', 'components', 'providers'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const patterns = [
  /EXPO_PUBLIC_PORTAL_URL/,
  /portal\.insureit\.in/,
  /\/api\/partner\//,
];
const except = new Set([
  'lib/partner-destinations.ts', // navigation IDs, no network calls
]);
const findings = [];
function walk(folder) {
  if (!fs.existsSync(folder)) return;
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const location = path.join(folder, item.name);
    if (item.isDirectory()) walk(location);
    else if (extensions.has(path.extname(item.name))) {
      const relative = path.relative(root, location).replaceAll(path.sep, '/');
      if (except.has(relative)) continue;
      const lines = fs.readFileSync(location, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        if (patterns.some(re => re.test(lines[i]))) {
          findings.push({ path: relative, line: i+1, code: lines[i].trim().slice(0,160) });
        }
      }
    }
  }
}
for (const folder of sources) walk(path.join(root,folder));
console.log(JSON.stringify({ count: findings.length, findings }, null, 2));
if (process.argv.includes('--enforce') && findings.length) {
  console.error('Partner production is not Vercel-independent. Refusing release.');
  process.exitCode = 1;
}
