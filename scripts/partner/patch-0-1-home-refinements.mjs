import fs from 'node:fs';

const target = process.argv[2];
if (!target) throw new Error('Usage: node patch-0-1-home-refinements.mjs <index.tsx>');

let source = fs.readFileSync(target, 'utf8');

const replaceOnce = (before, after, label) => {
  if (!source.includes(before)) throw new Error(`Expected ${label} source was not found`);
  source = source.replace(before, after);
};

const replaceRegexOnce = (pattern, replacement, label) => {
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) throw new Error(`Expected exactly one ${label} block, found ${matches?.length ?? 0}`);
  source = source.replace(pattern, replacement);
};

// Improve hero contrast without touching the approved artwork crop/height/search overlap.
replaceOnce(
  `  heroIconButton: { width: 33, height: 33, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,58,120,0.34)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.90)' },`,
  `  heroIconButton: { width: 33, height: 33, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,33,78,0.72)', borderWidth: 1.25, borderColor: 'rgba(255,255,255,0.96)', shadowColor: '#001B42', shadowOpacity: 0.24, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },`,
  'hero activity contrast',
);
replaceOnce(
  `  heroAvatar: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F1FF' },`,
  `  heroAvatar: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.98)', shadowColor: '#001B42', shadowOpacity: 0.22, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },`,
  'hero avatar contrast',
);
replaceOnce(
  `  heroGreeting: { zIndex: 2, position: 'absolute', left: 16, right: 82, bottom: 24 },`,
  `  heroGreeting: { zIndex: 2, position: 'absolute', left: 14, bottom: 24, maxWidth: '76%', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, backgroundColor: 'rgba(3,30,68,0.42)' },`,
  'hero greeting contrast shell',
);
replaceOnce(
  `  heroGreetingText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '500', letterSpacing: -0.04, textShadowColor: 'rgba(0,0,0,0.20)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },`,
  `  heroGreetingText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '600', letterSpacing: -0.04, textShadowColor: 'rgba(0,0,0,0.52)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },`,
  'hero greeting text contrast',
);

// Use the dedicated policy-add asset so Policy Intake is rendered through the same
// image-based QuickAction treatment as Renewals, Claims and Customers.
replaceOnce(
  `  policyAdd: require('../../assets/figma-dashboard/quick-policy-intake.png'),`,
  `  policyAdd: require('../../assets/generated-dashboard/policy-add.png'),`,
  'policy intake quick-action asset',
);

// The generated policy-add PNG has more transparent padding than the other Quick Action assets.
// Scale only this asset visually so its visible mark matches the surrounding icon sizes without
// changing the Quick Action card geometry or any of the other icons.
replaceOnce(
  `<QuickAction asset={GeneratedDashboardAssets.policyAdd} label="Policy Intake" onPress={() => router.push('/policy-intake-new')} />`,
  `<QuickAction asset={GeneratedDashboardAssets.policyAdd} imageScale={1.22} label="Policy Intake" onPress={() => router.push('/policy-intake-new')} />`,
  'policy intake quick-action scale',
);
replaceOnce(
  `function QuickAction({ icon, asset, label, onPress }: { icon?: DashboardIconName; asset?: number; label: string; onPress: () => void }) {`,
  `function QuickAction({ icon, asset, imageScale = 1, label, onPress }: { icon?: DashboardIconName; asset?: number; imageScale?: number; label: string; onPress: () => void }) {`,
  'QuickAction imageScale prop',
);
replaceOnce(
  `<Image source={asset} style={styles.quickImageAsset} resizeMode="contain" />`,
  `<Image source={asset} style={[styles.quickImageAsset, imageScale !== 1 && { transform: [{ scale: imageScale }] }]} resizeMode="contain" />`,
  'QuickAction scaled image rendering',
);

// Compact Pending Tasks. Keep every task and route; card grows only when multiple rows exist.
const pendingStyleReplacements = [
  [`  pendingCard: { marginTop: 8, minHeight: 134, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E3F2FF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D3E7FA' },`, `  pendingCard: { marginTop: 8, paddingHorizontal: 12, paddingTop: 7, paddingBottom: 6, borderRadius: 15, overflow: 'hidden', backgroundColor: '#E3F2FF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D3E7FA' },`, 'pending card'],
  [`  pendingBackdrop: { position: 'absolute', right: -2, top: -9, width: 207, height: 156, opacity: 0.68 },`, `  pendingBackdrop: { position: 'absolute', right: 3, top: 13, width: 88, height: 67, opacity: 0.28 },`, 'pending artwork'],
  [`  pendingHeaderSpacer: { width: 185, height: 1 },`, `  pendingHeaderSpacer: { width: 76, height: 1 },`, 'pending header spacer'],
  [`  pendingList: { marginTop: 2, paddingRight: 178 },`, `  pendingList: { marginTop: 0, paddingRight: 68 },`, 'pending list'],
  [`  pendingRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },`, `  pendingRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 },`, 'pending row'],
  [`  pendingRowAsset: { width: 30, height: 30 },`, `  pendingRowAsset: { width: 25, height: 25 },`, 'pending row asset'],
  [`  pendingCount: { minWidth: 22, color: '#D84D43', fontSize: 13, lineHeight: 17, fontWeight: '800', textAlign: 'center' },`, `  pendingCount: { minWidth: 18, color: '#D84D43', fontSize: 12, lineHeight: 15, fontWeight: '800', textAlign: 'center' },`, 'pending count'],
  [`  pendingTitle: { color: '#17345F', fontSize: 11, lineHeight: 15, fontWeight: '700' },`, `  pendingTitle: { color: '#17345F', fontSize: 10.5, lineHeight: 14, fontWeight: '700' },`, 'pending title'],
  [`  pendingSubtitle: { marginTop: 1, color: '#6B7B90', fontSize: 9.5, lineHeight: 13 },`, `  pendingSubtitle: { marginTop: 0, color: '#6B7B90', fontSize: 9, lineHeight: 12 },`, 'pending subtitle'],
];
for (const [before, after, label] of pendingStyleReplacements) replaceOnce(before, after, label);

// Recent Activity remains available from the clock button, but is intentionally removed from Home.
replaceRegexOnce(
  /\n\s*\{activity\.length \? \([\s\S]*?<PartnerEnter delay=\{165\}>[\s\S]*?<\/PartnerEnter>\n\s*\) : null\}\n/,
  '\n',
  'Recent Activity home section',
);

// Your Impact remains available on its dedicated route, but is removed from Home to keep the
// dashboard focused and compact.
replaceRegexOnce(
  /\n\s*<PartnerEnter delay=\{195\}>[\s\S]*?<Text style=\{styles\.sectionTitle\}>Your Impact<\/Text>[\s\S]*?<\/PartnerEnter>\n/,
  '\n',
  'Your Impact home section',
);

fs.writeFileSync(target, source);
