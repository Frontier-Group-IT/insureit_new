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

assert.match(helper, /import \{ File \} from 'expo-file-system'/);
assert.match(helper, /export async function readClaimDocumentBytes/);
assert.match(helper, /await file.bytes\(\)/);
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
  assert.match(content, /readClaimDocumentBytes/, screen);
  assert.doesNotMatch(content, /fetch\((?:file|pickedFile)\.uri\)/, screen);
  assert.doesNotMatch(content, /contentType: (file|pickedFile)\.mimeType \?\? 'application\/octet-stream'/, screen);
}
assert.match(transport, /if \(xhr\.status === 0\)/);
assert.match(claim, /'metadata', error/);
assert.match(selfManaged, /'metadata', insertError/);

// Rejected claim documents must navigate to the original upload stage, not the
// claim's current (possibly 100%-completed) processing or payment stage.
const tracker = read('app/customer/claim-detail.tsx');
const reuploads = read('lib/customer-claim-reupload.ts');
const spotUpload = read('app/customer/self-managed-claim.tsx');
const spotInternal = read('components/internal-claim-stage-one-tracker.tsx');
const milestone = read('app/customer/self-managed-milestone.tsx');
const internalParity = read('components/internal-claim-stage-parity.tsx');
const sharedScreen = read('components/ui.tsx');
assert.match(tracker, /outstandingClaimReuploads\(reuploadNotices, documents\)/);
assert.match(tracker, /openReuploadStage\(reuploadDocumentType\(notice\)\)/);
assert.match(tracker, /reuploadDocumentStage\(documentType, documents\)/);
assert.doesNotMatch(tracker, /onPress=\{\(\) => selfManaged \? \(currentStage \? openSelfStage\(currentStage\.key\)/);
assert.match(tracker, /useFocusEffect\(useCallback\(\(\) => \{/);
assert.match(reuploads, /latest\?\.verification_status === 'rejected'/);
assert.match(reuploads, /seen\.some/);
assert.match(reuploads, /initialClaimDocuments\.some/);
assert.match(reuploads, /return 'spot_intimation'/);
assert.match(reuploads, /return 'claim_intimation'/);
assert.match(spotUpload, /scrollTargetY=\{focusDocumentType \? documentSectionY : null\}/);
assert.match(spotUpload, /focusReupload=\{focusDocumentType === 'RC Copy'\}/);
assert.match(spotInternal, /scrollTargetY=\{focusDocumentType \? documentSectionY : null\}/);
assert.match(milestone, /focusDocumentType=\{focusDocumentType\}/);
assert.match(internalParity, /focusDocumentType=\{focusDocumentType\}/);
assert.match(claim, /setActiveKey\(matchingGroup\.key\)/);
assert.match(claim, /styles\.reuploadFocusCard/);
assert.match(sharedScreen, /scrollRef\.current\?\.scrollTo/);

console.log('Customer document upload regression contracts passed.');
