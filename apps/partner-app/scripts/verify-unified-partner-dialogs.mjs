import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const base = 'apps/partner-app';
const read = file => readFileSync(join(base, file), 'utf8');
const walk = directory => readdirSync(join(base, directory), { withFileTypes: true })
  .flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : /\.(tsx|ts)$/.test(path) ? [path] : [];
  });

const app = read('app/_layout.tsx');
const presenter = read('components/ui/partner-alert-provider.tsx');
const dialog = read('components/ui/partner-confirm-dialog.tsx');
assert.match(app, /<PartnerAlertProvider>/, 'Global presenter must wrap navigation');
assert.match(presenter, /export function partnerAlert\(/, 'Existing alert callbacks have a shared bridge');
assert.match(presenter, /choice\.onPress\?\.\(\)/, 'Confirmation callbacks are preserved');
assert.match(presenter, /cancelable === true/, 'Native alerts cannot dismiss by tapping outside unless requested');
assert.match(dialog, /KIND_ICON/, 'Success, error, warning, info and destructive states use the same icon treatment');
assert.match(dialog, /accessibilityViewIsModal/, 'Dialog is exposed to screen readers');
assert.match(dialog, /displayedActions\.map/, 'One, two and multi-action confirmations use the same surface');

const sourceFiles = [...walk('app'), ...walk('components')];
const exceptions = new Set(['components/ui/partner-alert-provider.tsx']);
for (const path of sourceFiles) {
  if (exceptions.has(path)) continue;
  const content = read(path);
  assert.doesNotMatch(content, /\bAlert\.alert\s*\(/, path + ' still uses the native alert instead of unified popup');
}
for (const path of [
  'app/partner-new.tsx','app/customer-new.tsx','app/partner-documents.tsx',
  'app/policy-intakes/onboarding.tsx','app/life-health-cases/[id].tsx',
  'app/claim/[id].tsx','components/partner-claim-stage-editor.tsx',
  'components/partner-claim-document-upload.tsx','app/account-deletion.tsx'
]) {
  assert.match(read(path), /partnerAlert\(/, path + ' must use the shared presenter');
}
assert.match(read('app/life-health-cases/[id].tsx'), /<Modal visible=\{remarkOpen\}/, 'Functional remark input remains an interactive modal');
assert.match(read('app/life-health-cases/[id].tsx'), /<Modal visible=\{approvalOpen\}/, 'OTP approval stays interactive');
console.log('Unified Partner dialog presentation, button callbacks and native-alert migration verified.');
