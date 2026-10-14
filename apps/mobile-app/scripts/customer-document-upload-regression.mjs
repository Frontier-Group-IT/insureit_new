// Regression contract for customer document uploads. Run: node scripts/customer-document-upload-regression.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, base), 'utf8');
const helper = read('lib/claim-document-upload.ts');
const claim = read('components/external-claim-document-tabs.tsx');
const vault = read('app/customer/upload-documents.tsx');
const selfManaged = read('app/customer/self-managed-documents.tsx');
const transport = read('lib/supabase.ts');

assert.match(helper, /export function claimUploadCustomerError/);
assert.match(helper, /export function logClaimUploadFailure/);
assert.match(helper, /status === 413/);
assert.match(helper, /status === 415/);
assert.match(helper, /step === 'storage' \? classifyClaimUploadStorageError\(error\)/);
for (const [screen, content] of [['claim intimation', claim], ['self managed vault', selfManaged], ['customer vault', vault]]) {
  assert.match(content, /resolveClaimUploadDescriptor/, screen);
  assert.match(content, /claimUploadCustomerError/, screen);
  assert.match(content, /claimUploadFileReadMessage/, screen);
  assert.match(content, /logClaimUploadFailure/, screen);
  assert.doesNotMatch(content, /contentType: (file|pickedFile)\.mimeType \?\? 'application\/octet-stream'/, screen);
}
assert.match(transport, /if \(xhr\.status === 0\)/);
assert.match(claim, /'metadata', error/);
assert.match(selfManaged, /'metadata', insertError/);
console.log('Customer document upload regression contracts passed.');
