import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const partnerRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(partnerRoot, '../..');
const failures = [];
let checks = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function expect(relativePath, pattern, description) {
  checks += 1;
  if (!pattern.test(read(relativePath))) failures.push(`${relativePath}: ${description}`);
}

const publish = '.github/workflows/publish-partner-preview-ota.yml';
const rollback = '.github/workflows/rollback-partner-preview-ota.yml';

// Publish must be Partner-only, exact-current-main and preview-channel scoped.
expect(publish, /EXPO_TOKEN_PARTNER/, 'publish must use the dedicated Partner Expo token');
expect(publish, /Require exact current main/, 'publish must verify exact current main');
expect(publish, /Partner app cannot share Customer EAS\/update identity/, 'publish must block Customer EAS/update identity reuse');
expect(publish, /--channel preview/, 'publish must target only the Partner preview channel');
expect(publish, /runtimePolicy !== 'appVersion'/, 'publish must require the appVersion runtime policy');
expect(publish, /apps\/partner-app\/\.trigger-preview-ota/, 'automatic Partner publish must remain limited to the Partner OTA trigger file');

// Rollback must require deliberate manual invocation and the same identity protections.
expect(rollback, /workflow_dispatch:/, 'rollback must require manual workflow dispatch');
expect(rollback, /on:\s*\n\s*workflow_dispatch:\s*\n/s, 'rollback trigger block must be manual-only');
expect(rollback, /EXPO_TOKEN_PARTNER/, 'rollback must use the dedicated Partner Expo token');
expect(rollback, /Require exact current main/, 'rollback must verify exact current main');
expect(rollback, /Partner app cannot share Customer EAS\/update identity/, 'rollback must block Customer EAS/update identity reuse');
expect(rollback, /--channel preview/, 'rollback must target only the Partner preview channel');
expect(rollback, /--runtime-version 0\.1\.0/, 'rollback must target the currently embedded frozen runtime');
expect(rollback, /update:roll-back-to-embedded/, 'rollback must recover to the embedded Partner bundle');

if (failures.length) {
  console.error('Partner OTA release contract verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`\n${failures.length} of ${checks} checks failed.`);
  process.exit(1);
}

console.log(`Partner OTA release contracts OK: ${checks} checks passed.`);
console.log('Publish is exact-main/Partner-only; rollback is manual-only, Partner-only and embedded-runtime scoped.');
