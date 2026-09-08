import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const startClaim = await readFile(new URL('../app/customer/start-claim.tsx', import.meta.url), 'utf8');
const spotIntimation = await readFile(new URL('../components/internal-claim-stage-one.tsx', import.meta.url), 'utf8');
const claimUploadHelper = await readFile(new URL('../lib/claim-document-upload.ts', import.meta.url), 'utf8');
const rootLayout = await readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
const appConfig = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8')).expo;
const easConfig = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));
const productionOtaWorkflow = await readFile(
  new URL('../../../.github/workflows/publish-customer-release-production-ota.yml', import.meta.url),
  'utf8',
);

const draftInsertIndex = startClaim.indexOf("supabase.from('claims').insert({");
const draftStatusIndex = startClaim.indexOf("current_status: 'Draft'", draftInsertIndex);
const draftIdSelectionIndex = startClaim.indexOf(".select('id').single()", draftInsertIndex);
const createdClaimNavigationIndex = startClaim.indexOf('draftClaimId: draftClaim.id', draftInsertIndex);

assert.ok(draftInsertIndex >= 0, 'Start Claim must create a managed claim row before entering the accident journey.');
assert.ok(draftStatusIndex > draftInsertIndex, 'New managed claims must be persisted with Draft status.');
assert.ok(draftIdSelectionIndex > draftStatusIndex, 'Start Claim must receive the persisted Draft claim id from Supabase.');
assert.ok(
  createdClaimNavigationIndex > draftIdSelectionIndex,
  'Navigation to report-accident must happen only after the Draft claim has been persisted and returned.',
);
assert.match(
  startClaim,
  /if \(draftError \|\| !draftClaim\?\.id\)[\s\S]*findActiveManagedClaim\(selectedPolicy\.id\)/,
  'Start Claim must retain duplicate/race recovery before reporting a creation failure.',
);

assert.match(
  spotIntimation,
  /primaryLabel=\{voiceRecording \? 'Stop recording first' : uploadingDocuments \? 'Uploading documents…' : saving \? 'Saving\.\.\.' : 'Save Details'\}/,
  'Spot Intimation primary action must be labeled Save Details.',
);
assert.doesNotMatch(
  spotIntimation,
  /Save\s*&\s*move\s*to\s*Initial\s*Documents\s*Submitted/i,
  'The old Spot Intimation action label must not return.',
);

const uploadFunctionStart = spotIntimation.indexOf('async function uploadClaimDocument');
const uploadFunctionEnd = spotIntimation.indexOf('async function uploadConcurrently', uploadFunctionStart);
const uploadFunction = spotIntimation.slice(uploadFunctionStart, uploadFunctionEnd);
assert.ok(uploadFunctionStart >= 0 && uploadFunctionEnd > uploadFunctionStart, 'Spot Intimation must keep the dedicated claim document upload function.');
assert.match(spotIntimation, /const CLAIM_UPLOAD_MAX_ATTEMPTS = 3;/, 'Customer claim document uploads must have a bounded three-attempt retry policy.');
assert.match(uploadFunction, /for \(let attempt = 1; attempt <= CLAIM_UPLOAD_MAX_ATTEMPTS; attempt \+= 1\)/, 'Storage upload must retry through the bounded attempt loop.');
assert.match(uploadFunction, /classifyClaimUploadStorageError\(uploadError\)/, 'Storage failures must be classified before retrying.');
assert.match(uploadFunction, /supabase\.auth\.refreshSession\(\)/, 'An auth-related Storage failure must refresh the session once before retrying.');
assert.match(uploadFunction, /failureKind === 'already_exists' && attempt > 1/, 'An ambiguous first upload that succeeded remotely must be recovered idempotently on retry.');
assert.match(uploadFunction, /if \(!storageUploaded\) return \{ ok: false, message: claimUploadStorageMessage\(pickedFile\.name, true\) \};/, 'The user must only see the Storage failure after automatic retries are exhausted.');
assert.equal(
  (uploadFunction.match(/supabase\.from\('claim_documents'\)\.insert/g) ?? []).length,
  1,
  'A retried Storage upload must still create exactly one claim_documents metadata record.',
);
assert.match(claimUploadHelper, /status === 401 \|\| status === 403/, 'Storage retry classification must distinguish authentication failures.');
assert.match(claimUploadHelper, /status === 408[\s\S]*status === 429[\s\S]*status >= 500/, 'Storage retry classification must cover timeout, throttling, and server failures.');
assert.match(claimUploadHelper, /status === 409[\s\S]*already exists/, 'Storage retry classification must recognize an already-created object after an ambiguous retry.');

assert.match(rootLayout, /Updates\.useUpdates\(\)/, 'Root layout must observe Expo update download state.');
assert.match(rootLayout, /isUpdatePending/, 'Root layout must detect a downloaded OTA waiting to be activated.');
assert.match(rootLayout, /Updates\.reloadAsync\(\)/, 'A downloaded startup OTA must be activated without requiring another manual cold launch.');
assert.match(rootLayout, /updateReloadRequested/, 'OTA activation must be guarded against duplicate reload requests.');

assert.equal(appConfig.version, '0.3.0', 'Customer OTA must remain compatible with production runtime 0.3.0.');
assert.equal(appConfig.android?.versionCode, 9, 'Customer OTA must remain aligned with production Android versionCode 9.');
assert.equal(appConfig.runtimeVersion?.policy, 'appVersion', 'Customer runtimeVersion policy must remain appVersion.');
assert.equal(easConfig.build?.production?.channel, 'production', 'Production APK/AAB must remain bound to Expo channel production.');
assert.match(productionOtaWorkflow, /--channel production/, 'Customer production OTA workflow must publish to Expo channel production.');
assert.match(productionOtaWorkflow, /github\.ref == 'refs\/heads\/main'/, 'Production OTA publication must remain restricted to main.');

console.log('Customer Start Claim / OTA activation / claim upload retry regression passed.');
