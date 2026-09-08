import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const startClaim = await readFile(new URL('../app/customer/start-claim.tsx', import.meta.url), 'utf8');
const spotIntimation = await readFile(new URL('../components/internal-claim-stage-one.tsx', import.meta.url), 'utf8');
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

console.log('Customer Start Claim / OTA activation regression passed.');
