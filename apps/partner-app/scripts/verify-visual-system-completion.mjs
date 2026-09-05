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
const customers = read('app/customers.tsx');
const policies = read('app/(tabs)/policies.tsx');
const claims = read('app/(tabs)/claims.tsx');
const renewals = read('app/renewals.tsx');
const policyIntakes = read('app/policy-intakes.tsx');
const search = read('app/search.tsx');
const support = read('app/support.tsx');
const settings = read('app/settings.tsx');
const activity = read('app/activity.tsx');

for (const asset of ['policyChecklist', 'appsGrid', 'settings', 'supportVerified']) {
  requireText(assets, `${asset}: require(`, `Partner asset registry must expose ${asset}.`);
}

for (const feature of [
  'policy intake',
  'renewal',
  'claim',
  'customer',
  'policies',
  'search',
  'support',
  'settings',
  'profile',
  'recognition',
  'journey',
  'impact',
  'your week',
  'learn',
  'stories',
  'activity',
  'business',
  'more',
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

if (more.includes('<MenuRow icon=')) {
  throw new Error('Feature rows in More must use Partner artwork instead of generic vector icons.');
}
for (const asset of ['PartnerAssets.actions.policyChecklist', 'PartnerAssets.status.businessGrowth', 'PartnerAssets.status.settings']) {
  requireText(more, asset, `More screen is missing ${asset}.`);
}

requireText(customers, 'PartnerAssets.emptyStates.noCustomers', 'Customers empty state must use the prepared no-customers artwork.');
requireText(policies, 'PartnerAssets.emptyStates.noPolicies', 'Policies empty state must use the prepared no-policies artwork.');
for (const product of ['motorInsurance', 'healthInsurance', 'familyInsurance', 'commercialInsurance']) {
  requireText(policies, `PartnerAssets.products.${product}`, `Policies must map ${product} artwork into policy rows.`);
}
requireText(claims, 'PartnerAssets.navigation.claims', 'Claims rows/empty state must use Partner claim artwork.');
requireText(claims, 'PartnerAssets.status.verified', 'Completed claims must use verified artwork.');
requireText(renewals, 'PartnerAssets.emptyStates.noRenewals', 'Renewal empty states must use the prepared no-renewals artwork.');
requireText(renewals, 'PartnerAssets.actions.renewals', 'Upcoming renewal rows must use Partner renewal artwork.');
requireText(policyIntakes, 'PartnerAssets.emptyStates.policyUpload', 'Empty Policy Intake history must use the prepared upload artwork.');
for (const statusAsset of ['verified', 'rejected', 'policyAttention', 'pendingReview', 'documentUpload']) {
  requireText(policyIntakes, `PartnerAssets.status.${statusAsset}`, `Policy Intake status mapping is missing ${statusAsset} artwork.`);
}

requireText(search, 'PartnerAssets.emptyStates.noSearchResults', 'Universal Search must use the prepared no-results artwork.');
for (const featureAsset of ['navigation.customers', 'navigation.policies', 'navigation.claims']) {
  requireText(search, `PartnerAssets.${featureAsset}`, `Universal Search is missing ${featureAsset} result artwork.`);
}
requireText(support, 'PartnerAssets.actions.supportVerified', 'Support fallback must use the prepared verified-support artwork.');
if (support.includes('asset={PartnerAssets.emptyStates.supportResolved}')) {
  throw new Error('Support-unavailable errors must not misuse the support-resolved artwork.');
}
for (const featureAsset of ['navigation.profile', 'actions.support', 'status.settings']) {
  requireText(settings, `PartnerAssets.${featureAsset}`, `Settings is missing ${featureAsset} feature artwork.`);
}

for (const activityAsset of ['status.policyActive', 'navigation.claims', 'navigation.policyIntake', 'actions.policyChecklist', 'status.announcement']) {
  requireText(activity, `PartnerAssets.${activityAsset}`, `Activity is missing ${activityAsset} artwork.`);
}
for (const tinySize of ['fontSize: 7.2', 'fontSize: 7.5', 'fontSize: 8.5', 'fontSize: 8,']) {
  if (activity.includes(tinySize)) throw new Error(`Activity must not regress to tiny timeline typography: ${tinySize}`);
}

console.log('Partner visual-system completion contracts verified.');
