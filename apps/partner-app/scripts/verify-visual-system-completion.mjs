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

for (const asset of [
  'PartnerAssets.actions.policyChecklist',
  'PartnerAssets.status.businessGrowth',
  'PartnerAssets.status.settings',
]) {
  requireText(more, asset, `More screen is missing ${asset}.`);
}

console.log('Partner visual-system completion contracts verified.');
