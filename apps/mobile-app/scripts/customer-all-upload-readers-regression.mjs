import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const screens = [
  ['Work Approval / claim action documents', 'components/internal-claim-stage-one.tsx', 1],
  ['Actual self-managed Work Approval, Assessment and Final Bill', 'app/customer/self-managed-milestone.tsx', 3],
  ['Spot Intimation / stage tracker', 'components/internal-claim-stage-one-tracker.tsx', 1],
  ['Self-managed claim stages', 'app/customer/self-managed-claim.tsx', 1],
  ['Claim Intimation single + multi', 'components/external-claim-document-tabs.tsx', 2],
  ['Self-managed documents', 'app/customer/self-managed-documents.tsx', 1],
  ['Claim document vault', 'app/customer/upload-documents.tsx', 1],
  ['Policy copy onboarding', 'app/customer/add-policy.tsx', 1],
  ['Dealership KYC', 'app/customer/kyc/dealership.tsx', 1],
  ['Corporate KYC', 'app/customer/kyc/corporate.tsx', 1],
  ['Profile photo + profile documents', 'app/customer/profile.tsx', 2],
];
for (const [area, path, minimumCalls] of screens) {
  const content = read(path);
  const calls = content.match(/readClaimDocumentBytes\(/g) ?? [];
  assert.ok(calls.length >= minimumCalls, area + ' must read picker bytes via Expo FileSystem');
  assert.doesNotMatch(content, /fetch\((?:file|asset|pickedFile|uploadUri|uri)\.uri\)|fetch\(uploadUri\)|fetch\(uri\)/, area);
}
const actualWorkApproval = read('app/customer/self-managed-milestone.tsx');
assert.match(actualWorkApproval, /function WorkApprovalPdfUpload/);
assert.match(actualWorkApproval, /logClaimUploadFailure\('work_approval', 'storage'/);
assert.doesNotMatch(actualWorkApproval, /fetch\(file\.uri\)/);
const kyc = read('app/customer/kyc/individual.tsx');
assert.match(kyc, /readPreparedCustomerDocument\(file\.uri\)/);
const helper = read('lib/claim-document-upload.ts');
assert.match(helper, /export async function readClaimDocumentBytes/);
assert.match(helper, /await file\.bytes\(\)/);
console.log('All customer document upload reader contracts passed.');
