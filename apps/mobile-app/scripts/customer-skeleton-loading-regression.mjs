import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.cwd(), 'apps/mobile-app');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const fail = (message) => {
  console.error(`Customer skeleton loading regression failed: ${message}`);
  process.exit(1);
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

const adapter = read('components/customer-aware-ui.tsx');
const skeleton = read('components/customer-page-skeleton.tsx');
const babelConfig = read('babel.config.js');
const tsconfig = read('tsconfig.json');
const startup = read('app/index.tsx');

expect(adapter.includes("pathname.startsWith('/customer')"), 'customer route detection is missing from the shared UI adapter');
expect(adapter.includes('<CustomerPageSkeleton pathname={pathname} label={label} />'), 'customer LoadingState is not routed to the skeleton component');
expect(adapter.includes('<BaseLoadingState label={label} />'), 'non-customer LoadingState fallback must remain unchanged');
expect(adapter.includes('showTitleHeader={false}'), 'customer loading-only Screen must suppress the normal title card while the skeleton is visible');
expect(adapter.includes('<BaseLoadingState label={loadingProps.label} />'), 'non-customer loading-only Screen must preserve the legacy centered loader behavior');

expect(!skeleton.includes('ActivityIndicator'), 'customer page skeleton must not fall back to the spinner loader');
for (const variant of ['dashboard', 'list', 'detail', 'form']) {
  expect(skeleton.includes(`'${variant}'`), `missing ${variant} skeleton variant`);
}
expect(skeleton.includes("'/customer/policies'"), 'policy list route is not covered by the route-aware skeleton');
expect(skeleton.includes("'/customer/vehicles'"), 'vehicle list route is not covered by the route-aware skeleton');
expect(skeleton.includes("'/customer/claims'"), 'claim list route is not covered by the route-aware skeleton');
expect(skeleton.includes("'/customer/claim-detail'"), 'claim detail route is not covered by the route-aware skeleton');
expect(skeleton.includes("'/customer/internal-claim-stage'"), 'internal claim stage route is not covered by the route-aware skeleton');
expect(skeleton.includes("'/customer/upload-documents'"), 'document upload route is not covered by the route-aware skeleton');

expect(babelConfig.includes("'^@/components/ui$': './components/customer-aware-ui'"), 'Metro/Babel must resolve the shared UI import through the customer-aware adapter');
expect(tsconfig.includes('"@/components/ui"'), 'TypeScript must resolve the shared UI import through the same customer-aware adapter');
expect(tsconfig.includes('"./components/customer-aware-ui"'), 'TypeScript shared UI alias target is incorrect');

expect(startup.includes('<StartupSkeleton />'), 'existing startup skeleton must remain enabled during session restoration');

const customerRouteRoot = path.join(root, 'app/customer');
const customerFiles = walk(customerRouteRoot).filter((file) => /\.(ts|tsx)$/.test(file));
const loadingStateConsumers = customerFiles.filter((file) => fs.readFileSync(file, 'utf8').includes('LoadingState'));
expect(loadingStateConsumers.length > 0, 'expected Customer routes to consume the shared LoadingState contract');

for (const file of loadingStateConsumers) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (/from\s+['"](?:\.\.\/)+components\/ui['"]/.test(source) || /from\s+['"]\.\/ui['"]/.test(source)) {
    fail(`${relative} bypasses the shared @/components/ui adapter`);
  }
}

console.log(`Customer skeleton loading regression passed for ${loadingStateConsumers.length} Customer route loading consumers.`);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}
