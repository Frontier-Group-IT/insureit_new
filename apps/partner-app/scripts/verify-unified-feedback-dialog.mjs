import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = relative => readFileSync(new URL('../' + relative, import.meta.url), 'utf8');
const root = read('app/_layout.tsx');
const renderer = read('components/ui/partner-feedback-dialog.tsx');
const legacy = read('components/ui/partner-confirm-dialog.tsx');
const service = read('lib/partner-alert.ts');

assert.match(root, /<PartnerAlertHost\s*\/>/, 'Shared alert host is mounted once at app root');
assert.match(renderer, /statusBarTranslucent/, 'Modal covers the platform status area');
assert.match(renderer, /accessibilityRole="alert"/, 'Popup is accessible to screen readers');
assert.match(renderer, /'checkmark-circle-outline'/, 'Success uses a positive icon');
assert.match(renderer, /'alert-circle-outline'/, 'Errors and warnings use the reference exclamation icon');
assert.match(renderer, /'trash-outline'/, 'Delete uses destructive icon');
assert.match(renderer, /style=\{styles\.divider\}/, 'Reference footer separator remains');
assert.match(renderer, /accessibilityState=\{\{ disabled: isBusy, busy: isBusy \}\}/, 'Busy state prevents repeated actions');
assert.match(service, /queue\.push\(/, 'Concurrent feedback messages are queued, not dropped');
assert.match(service, /if \(receiver && !active && queue\.length > 0\)/, 'Only one popup is presented at a time');
assert.match(legacy, /<PartnerFeedbackDialog/, 'Existing confirmation component uses reference layout');
assert.match(legacy, /kind: destructive \? 'destructive' : 'primary'/, 'Dangerous actions retain destructive styling');
assert.match(legacy, /onPress: onCancel/, 'Cancel button keeps its current handler');
assert.match(legacy, /onPress: onConfirm/, 'Confirm button keeps its current handler');

const nativeAlertFiles = [
 'app/account-deletion.tsx',
 'app/claim/[id].tsx',
 'app/claim/select-vehicle.tsx',
 'app/customer-new.tsx',
 'app/insurers.tsx',
 'app/life-health-cases/[id].tsx',
 'app/partner-documents.tsx',
 'app/partner-new.tsx',
 'app/policy-intakes/onboarding.tsx',
 'components/misp-partner-form.tsx',
 'components/partner-claim-document-upload.tsx',
 'components/partner-claim-documents.tsx',
 'components/partner-claim-stage-editor.tsx',
 'components/partner-claim-workshop-stages.tsx',
 'components/partner-payment-encashment.tsx',
 'components/partner-spot-intimation.tsx',
 'components/partner-vehicle-delivery.tsx',
];
for (const file of nativeAlertFiles) {
  const screen = read(file);
  assert.match(screen, /import \{ Alert \} from '@\/lib\/partner-alert'/, file + ' must use the in-app feedback system');
  assert.doesNotMatch(screen, /import\s*\{[^}]*\bAlert\b[^}]*\}\s*from ['"]react-native['"]/, file + ' must not use OS-native Alert');
}
console.log('Unified Partner App feedback, confirmation and legacy Alert migration checks passed.');
