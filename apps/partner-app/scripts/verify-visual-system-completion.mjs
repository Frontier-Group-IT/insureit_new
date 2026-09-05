import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function requireText(source, needle, message) {
  if (!source.includes(needle)) throw new Error(message);
}

const assets = read('lib/partner-assets.ts');
const artworkMap = read('lib/partner-screen-artwork.ts');
const topBar = read('components/ui/partner-top-bar.tsx');
const stateView = read('components/ui/partner-state-view.tsx');
const screen = read('components/partner-screen.tsx');
const listScreen = read('components/partner-list-screen.tsx');
const more = read('app/(tabs)/more.tsx');
const business = read('app/(tabs)/business.tsx');
const customers = read('app/customers.tsx');
const policies = read('app/(tabs)/policies.tsx');
const claims = read('app/(tabs)/claims.tsx');
const renewals = read('app/renewals.tsx');
const policyIntakes = read('app/policy-intakes.tsx');
const policyIntakeNew = read('app/policy-intake-new.tsx');
const policyIntakeDetail = read('app/policy-intakes/[id].tsx');
const search = read('app/search.tsx');
const support = read('app/support.tsx');
const settings = read('app/settings.tsx');
const activity = read('app/activity.tsx');
const impact = read('app/impact.tsx');
const journey = read('app/journey.tsx');
const weeklyStory = read('app/weekly-story.tsx');
const recognition = read('app/recognition.tsx');
const learn = read('app/learn.tsx');

for (const asset of ['policyChecklist', 'appsGrid', 'settings', 'supportVerified']) {
  requireText(assets, `${asset}: require(`, `Partner asset registry must expose ${asset}.`);
}

for (const feature of [
  'policy intake', 'renewal', 'claim', 'customer', 'policies', 'search', 'support', 'settings', 'profile',
  'recognition', 'journey', 'impact', 'your week', 'learn', 'stories', 'activity', 'business', 'more',
]) {
  requireText(artworkMap, `'${feature}'`, `Screen artwork mapping is missing ${feature}.`);
}

requireText(topBar, 'resolvePartnerScreenArtwork({ title, eyebrow })', 'PartnerTopBar must resolve feature artwork centrally.');
requireText(topBar, 'resolvedArtwork', 'PartnerTopBar must render the resolved feature artwork.');
requireText(screen, 'artwork={artwork}', 'PartnerScreen must preserve explicit artwork overrides.');
requireText(listScreen, 'artwork={artwork}', 'PartnerListScreen must preserve explicit artwork overrides.');

requireText(stateView, 'PartnerAssets.emptyStates.offline', 'Offline state must use branded Partner artwork.');
requireText(stateView, 'PartnerAssets.emptyStates.validationError', 'Generic error state must use branded Partner artwork.');
requireText(stateView, 'PartnerAssets.emptyStates.incompleteDetails', 'Unauthorized state must use branded Partner artwork.');

if (more.includes('<MenuRow icon=')) throw new Error('Feature rows in More must use Partner artwork instead of generic vector icons.');
for (const asset of ['PartnerAssets.actions.policyChecklist', 'PartnerAssets.status.businessGrowth', 'PartnerAssets.status.settings']) requireText(more, asset, `More screen is missing ${asset}.`);

for (const businessAsset of ['actions.renewals', 'navigation.claims', 'actions.businessPerformance']) {
  requireText(business, `PartnerAssets.${businessAsset}`, `Business is missing ${businessAsset} artwork.`);
}
if (business.includes('icon="refresh-outline"') || business.includes('icon="shield-outline"') || business.includes('git-network-outline')) {
  throw new Error('Business feature cards/network must not regress to generic feature glyphs.');
}
requireText(business, 'if (!payout.available)', 'Business payout authorization gate must remain intact.');
requireText(business, 'getPartnerPayoutSummary()', 'Business must continue loading payout data through the existing service.');

requireText(customers, 'PartnerAssets.emptyStates.noCustomers', 'Customers empty state must use the prepared no-customers artwork.');
requireText(policies, 'PartnerAssets.emptyStates.noPolicies', 'Policies empty state must use the prepared no-policies artwork.');
for (const product of ['motorInsurance', 'healthInsurance', 'familyInsurance', 'commercialInsurance']) requireText(policies, `PartnerAssets.products.${product}`, `Policies must map ${product} artwork into policy rows.`);
requireText(claims, 'PartnerAssets.navigation.claims', 'Claims rows/empty state must use Partner claim artwork.');
requireText(claims, 'PartnerAssets.status.verified', 'Completed claims must use verified artwork.');
requireText(renewals, 'PartnerAssets.emptyStates.noRenewals', 'Renewal empty states must use the prepared no-renewals artwork.');
requireText(renewals, 'PartnerAssets.actions.renewals', 'Upcoming renewal rows must use Partner renewal artwork.');
requireText(policyIntakes, 'PartnerAssets.emptyStates.policyUpload', 'Empty Policy Intake history must use the prepared upload artwork.');
for (const statusAsset of ['verified', 'rejected', 'policyAttention', 'pendingReview', 'documentUpload']) requireText(policyIntakes, `PartnerAssets.status.${statusAsset}`, `Policy Intake status mapping is missing ${statusAsset} artwork.`);

for (const intakeAsset of ['status.documentUpload', 'status.verified']) {
  requireText(policyIntakeNew, `PartnerAssets.${intakeAsset}`, `New Policy Intake is missing ${intakeAsset} artwork.`);
}
requireText(policyIntakeNew, 'submitPartnerPolicyIntake({', 'New Policy Intake must preserve the existing submit service path.');
requireText(policyIntakeNew, 'savePartnerPolicyIntakeDraft({', 'New Policy Intake must preserve draft saving.');
requireText(policyIntakeNew, 'loadPartnerPolicyIntakeDraft()', 'New Policy Intake must preserve draft restore.');

for (const intakeDetailAsset of ['emptyStates.policyUpload', 'status.documentUpload', 'status.pendingReview', 'status.policyAttention', 'status.verified', 'status.rejected']) {
  requireText(policyIntakeDetail, `PartnerAssets.${intakeDetailAsset}`, `Policy Intake detail is missing ${intakeDetailAsset} artwork.`);
}
requireText(policyIntakeDetail, 'function statusArtwork(row: PartnerPolicyIntake)', 'Policy Intake detail must keep centralized semantic status-artwork mapping.');
requireText(policyIntakeDetail, 'submitPartnerPolicyIntakeReplacement({', 'Policy Intake detail must preserve the replacement upload service path.');
if (policyIntakeDetail.includes('git-network-outline') || policyIntakeDetail.includes('alert-circle-outline')) {
  throw new Error('Policy Intake status and attention surfaces must not regress to generic feature glyphs.');
}

requireText(search, 'PartnerAssets.emptyStates.noSearchResults', 'Universal Search must use the prepared no-results artwork.');
for (const featureAsset of ['navigation.customers', 'navigation.policies', 'navigation.claims']) requireText(search, `PartnerAssets.${featureAsset}`, `Universal Search is missing ${featureAsset} result artwork.`);
requireText(support, 'PartnerAssets.actions.supportVerified', 'Support fallback must use the prepared verified-support artwork.');
if (support.includes('asset={PartnerAssets.emptyStates.supportResolved}')) throw new Error('Support-unavailable errors must not misuse the support-resolved artwork.');
for (const featureAsset of ['navigation.profile', 'actions.support', 'status.settings']) requireText(settings, `PartnerAssets.${featureAsset}`, `Settings is missing ${featureAsset} feature artwork.`);

for (const activityAsset of ['status.policyActive', 'navigation.claims', 'navigation.policyIntake', 'actions.policyChecklist', 'status.announcement']) requireText(activity, `PartnerAssets.${activityAsset}`, `Activity is missing ${activityAsset} artwork.`);
for (const tinySize of ['fontSize: 7.2', 'fontSize: 7.5', 'fontSize: 8.5', 'fontSize: 8,']) if (activity.includes(tinySize)) throw new Error(`Activity must not regress to tiny timeline typography: ${tinySize}`);

for (const impactAsset of ['products.motorInsurance', 'navigation.customers', 'navigation.policies', 'navigation.claims', 'status.verified', 'status.journey']) requireText(impact, `PartnerAssets.${impactAsset}`, `Impact is missing ${impactAsset} artwork.`);
for (const tinySize of ['fontSize: 7.5', 'fontSize: 8.5', 'fontSize: 8,']) if (impact.includes(tinySize)) throw new Error(`Impact must not regress to tiny typography: ${tinySize}`);
requireText(journey, 'PartnerAssets.status.journey', 'Journey timeline and empty state must use journey artwork.');
for (const tinySize of ['fontSize: 7.5', 'fontSize: 8.5', 'fontSize: 8,']) if (journey.includes(tinySize)) throw new Error(`Journey must not regress to tiny typography: ${tinySize}`);

requireText(weeklyStory, 'PartnerAssets.actions.renewals', 'Your Week must keep renewal artwork for upcoming work.');
for (const tinySize of ['fontSize:7.5', 'fontSize:8.5', 'fontSize:8,', 'fontSize:9,']) if (weeklyStory.includes(tinySize)) throw new Error(`Your Week must not regress to tiny typography: ${tinySize}`);
for (const recognitionAsset of ['status.achievement', 'actions.policyChecklist', 'actions.renewals', 'status.journey']) requireText(recognition, `PartnerAssets.${recognitionAsset}`, `Recognition is missing ${recognitionAsset} artwork.`);
for (const tinySize of ['fontSize:7.5', 'fontSize:8.5']) if (recognition.includes(tinySize)) throw new Error(`Recognition must not regress to tiny typography: ${tinySize}`);
for (const learnAsset of ['actions.policyChecklist', 'status.verified']) requireText(learn, `PartnerAssets.${learnAsset}`, `Learn is missing ${learnAsset} artwork.`);
for (const tinySize of ['fontSize: 7.2', 'fontSize: 7.5', 'fontSize: 8.5', 'fontSize: 8,', 'fontSize: 9,']) if (learn.includes(tinySize)) throw new Error(`Learn must not regress to tiny typography: ${tinySize}`);

console.log('Partner visual-system completion contracts verified.');
