import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2];
if (!target) throw new Error('Usage: node patch-0-1-partner-screen-hide-topbar.mjs <partner-screen.tsx>');

let source = fs.readFileSync(target, 'utf8');

const replaceOnce = (before, after, label) => {
  if (!source.includes(before)) throw new Error(`Expected ${label} source was not found`);
  source = source.replace(before, after);
};

replaceOnce(
  `  action,\n  children,`,
  `  action,\n  hideTopBar,\n  children,`,
  'PartnerScreen argument list',
);

replaceOnce(
  `  action?: ReactNode;\n  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;`,
  `  action?: ReactNode;\n  hideTopBar?: boolean;\n  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;`,
  'PartnerScreen props',
);

replaceOnce(
  `        <PartnerTopBar\n          title={title}\n          eyebrow={eyebrow}\n          subtitle={subtitle}\n          onBack={onBack}\n          backDisabled={backDisabled}\n          artwork={artwork}\n          action={action}\n        />`,
  `        {hideTopBar ? null : (\n          <PartnerTopBar\n            title={title}\n            eyebrow={eyebrow}\n            subtitle={subtitle}\n            onBack={onBack}\n            backDisabled={backDisabled}\n            artwork={artwork}\n            action={action}\n          />\n        )}`,
  'PartnerTopBar render',
);

fs.writeFileSync(target, source);

// The installed Partner APK remains on runtime 0.1.0. The cumulative OTA workflow
// checks out the approved 0.1.0 compatibility source, so explicitly carry the
// current Activity/Profile/Network reference redesigns and shared catalog-logo
// dependencies into that compatibility checkout before typecheck/publish.
const compatAppRoot = path.resolve(path.dirname(target), '..');
const toolingAppRoot = path.resolve('tooling/apps/partner-app');
const activitySource = path.join(toolingAppRoot, 'app/activity.tsx');
const activityTarget = path.join(compatAppRoot, 'app/activity.tsx');
const profileSource = path.join(toolingAppRoot, 'app/profile.tsx');
const profileTarget = path.join(compatAppRoot, 'app/profile.tsx');
const networkSource = path.join(toolingAppRoot, 'app/network.tsx');
const networkTarget = path.join(compatAppRoot, 'app/network.tsx');
const catalogSource = path.join(toolingAppRoot, 'lib/catalog-logos.ts');
const catalogTarget = path.join(compatAppRoot, 'lib/catalog-logos.ts');
const catalogAssetsSource = path.join(toolingAppRoot, 'assets/catalog');
const catalogAssetsTarget = path.join(compatAppRoot, 'assets/catalog');

for (const required of [activitySource, profileSource, networkSource, catalogSource, catalogAssetsSource]) {
  if (!fs.existsSync(required)) throw new Error(`Required Partner 0.1 OTA source is missing: ${required}`);
}

fs.mkdirSync(path.dirname(activityTarget), { recursive: true });
fs.mkdirSync(path.dirname(profileTarget), { recursive: true });
fs.mkdirSync(path.dirname(networkTarget), { recursive: true });
fs.mkdirSync(path.dirname(catalogTarget), { recursive: true });
fs.copyFileSync(activitySource, activityTarget);
fs.copyFileSync(profileSource, profileTarget);
fs.copyFileSync(networkSource, networkTarget);
fs.copyFileSync(catalogSource, catalogTarget);
fs.cpSync(catalogAssetsSource, catalogAssetsTarget, { recursive: true, force: true });

const activity = fs.readFileSync(activityTarget, 'utf8');
if (!activity.includes('Recent activity') || activity.includes('styles.rail') || activity.includes('styles.line')) {
  throw new Error('Partner 0.1 Activity reference redesign was not installed cleanly');
}

const profile = fs.readFileSync(profileTarget, 'utf8');
if (
  !profile.includes('Profile & registration') ||
  !profile.includes('AUTHORIZED BUSINESS SCOPE') ||
  !profile.includes("backgroundColor: '#F2F7FF'") ||
  profile.includes("backgroundColor: partnerTheme.colors.accentSoft") ||
  profile.includes("borderColor: '#CDEAE7'") ||
  profile.includes("color: '#3C7B78'")
) {
  throw new Error('Partner 0.1 Profile reference redesign was not installed cleanly');
}

const network = fs.readFileSync(networkTarget, 'utf8');
if (
  !network.includes('Search partner by name or code...') ||
  !network.includes('Commercial relationships') ||
  !network.includes('Partner families') ||
  !network.includes("type NetworkFilter = 'all' | 'grouped' | 'ungrouped'") ||
  !network.includes('metricVisuals') ||
  !network.includes('hideTopBar')
) {
  throw new Error('Partner 0.1 Network commercial reference redesign was not installed cleanly');
}
