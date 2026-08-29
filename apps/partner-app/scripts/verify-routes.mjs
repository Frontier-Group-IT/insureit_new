import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const partnerRoot = path.resolve(scriptDir, '..');
const root = path.join(partnerRoot, 'app');
const routeFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx|ts)$/.test(entry.name) && entry.name !== '_layout.tsx') routeFiles.push(full);
  }
}
walk(root);

function fileToRoute(file) {
  let rel = path.relative(root, file).replaceAll('\\', '/').replace(/\.(tsx|ts)$/, '');
  rel = rel.replace(/(^|\/)index$/, '$1');
  const pieces = rel.split('/').filter(Boolean).filter((part) => !/^\(.+\)$/.test(part));
  return '/' + pieces.join('/');
}

const routes = new Set(routeFiles.map(fileToRoute));
routes.add('/');

const sourceFiles = [];
function walkSource(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'dist-web' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSource(full);
    else if (/\.(tsx|ts)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walkSource(partnerRoot);

const dynamicRoutes = [...routes].filter((route) => route.includes('['));
function routeExists(route) {
  const clean = route.split('?')[0].split('#')[0];
  if (routes.has(clean)) return true;
  return dynamicRoutes.some((pattern) => {
    const regex = new RegExp('^' + pattern.replace(/\[\[\.\.\..+?\]\]|\[\.\.\..+?\]/g, '.+').replace(/\[[^/]+?\]/g, '[^/]+') + '$');
    return regex.test(clean);
  });
}

const routeLiteral = /(?:router\.(?:push|replace)|href\s*=)\s*\(?\s*['"`]([^'"`]+)['"`]/g;
const missing = [];
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(routeLiteral)) {
    const route = match[1];
    if (!route.startsWith('/') || route.includes('${')) continue;
    if (!routeExists(route)) missing.push({ file: path.relative(partnerRoot, file), route });
  }
}

const required = [
  '/login', '/pulse', '/impact', '/journey', '/network', '/learn', '/stories',
  '/weekly-story', '/recognition', '/support', '/renewals', '/customers', '/activity', '/profile',
  '/policy-intakes', '/policy-intake-new', '/customer/[id]', '/policy/[id]', '/claim/[id]'
];

const missingRequired = required.filter((route) => !routes.has(route));
if (!fs.existsSync(path.join(root, '(tabs)'))) missingRequired.push('/(tabs)');

if (missing.length || missingRequired.length) {
  if (missing.length) {
    console.error('Missing routes referenced by Partner app:');
    for (const item of missing) console.error(`- ${item.file}: ${item.route}`);
  }
  if (missingRequired.length) console.error(`Missing required Partner routes: ${missingRequired.join(', ')}`);
  process.exit(1);
}

console.log(`Partner route integrity OK: ${routes.size} route files checked, ${sourceFiles.length} source files scanned.`);
