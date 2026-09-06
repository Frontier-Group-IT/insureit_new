import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const source = fs.readFileSync(path.join(root, 'lib/partner-push-notification-templates.ts'), 'utf8');

const requiredTypes = [
  'renewal_due',
  'claim_update',
  'intake_attention',
  'intake_approved',
  'intake_rejected',
];
for (const type of requiredTypes) {
  if (!source.includes(`"${type}"`)) throw new Error(`Partner push template missing event type: ${type}`);
}

for (const requiredRoute of ['"/renewals"', '"/(tabs)/claims"', '"/policy-intakes"']) {
  if (!source.includes(requiredRoute)) throw new Error(`Partner push template missing safe destination: ${requiredRoute}`);
}

for (const forbidden of [
  'expo_push_token',
  'partner_push_devices',
  'exp.host',
  'api.push.apple.com',
  'fcm.googleapis.com',
  'fetch(',
  'createSupabaseAdminClient',
  'SUPABASE_SERVICE_ROLE_KEY',
  'policy_number',
  'claim_number',
  'mobile',
  'customer_name',
  'registration_number',
]) {
  if (source.includes(forbidden)) throw new Error(`Pure Partner push template layer must not contain active delivery/PII concern: ${forbidden}`);
}

const literalCopy = [...source.matchAll(/(?:title|body):\s*"([^"]*)"/g)].map((match) => match[1]);
for (const copy of literalCopy) {
  if (/\b\d{4,}\b/.test(copy) || /@/.test(copy)) {
    throw new Error(`Partner push copy must not expose identifiers or contact data: ${copy}`);
  }
}

if (!source.includes('channelId: "partner-updates"')) {
  throw new Error('Partner push templates must use the approved Partner notification channel.');
}
if (!source.includes('Unsupported Partner push event type.')) {
  throw new Error('Partner push template builder must fail closed for unknown event types.');
}

console.log('Partner push notification template contract verified: generic copy, safe destinations, no delivery side effects.');
