import fs from 'node:fs';

const target = process.argv[2];
if (!target) {
  throw new Error('Usage: node patch-0-1-home-hero-reference.mjs <index.tsx>');
}

let source = fs.readFileSync(target, 'utf8');

const replaceOnce = (before, after, label) => {
  if (!source.includes(before)) {
    throw new Error(`Expected ${label} source was not found`);
  }
  source = source.replace(before, after);
};

replaceOnce(
  `<SafeAreaView style={styles.safeArea} edges={['top']}>`,
  `<SafeAreaView style={styles.safeArea} edges={[]}>`,
  'safe-area declaration',
);

replaceOnce(
  `              accessibilityLabel="View recent activity"\n                onPress={() => router.push('/activity')}\n                style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}\n              >\n                <Feather name="bell" size={20} color="#FFFFFF" />`,
  `              accessibilityLabel="View recent activity"\n                onPress={() => router.push('/activity')}\n                style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}\n              >\n                <Feather name="clock" size={17} color="#FFFFFF" />`,
  'activity icon',
);

const styleReplacements = [
  [
    `  safeArea: { flex: 1, backgroundColor: '#073A78' },`,
    `  safeArea: { flex: 1, backgroundColor: '#0757AE' },`,
    'safe-area color',
  ],
  [
    `  hero: { height: 152, overflow: 'hidden', backgroundColor: '#054D9E', paddingTop: 9 },`,
    `  hero: { height: 158, overflow: 'hidden', backgroundColor: '#0757AE', paddingTop: 30 },`,
    'hero sizing',
  ],
  [
    `  heroBackdrop: { ...StyleSheet.absoluteFillObject, opacity: 1 },`,
    `  heroBackdrop: { position: 'absolute', left: '-6%', top: -8, width: '112%', height: 182, opacity: 1, transform: [{ scale: 0.92 }] },`,
    'hero artwork framing',
  ],
  [
    `  heroBackdropShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,34,75,0.06)' },`,
    `  heroBackdropShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,42,93,0.03)' },`,
    'hero shade',
  ],
  [
    `  heroTopRow: { zIndex: 2, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 14 },`,
    `  heroTopRow: { zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },`,
    'hero top row',
  ],
  [
    `  heroBrand: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, maxWidth: '60%' },`,
    `  heroBrand: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '60%' },`,
    'hero brand row',
  ],
  [
    `  heroLogo: { width: 33, height: 39, tintColor: '#FFFFFF' },`,
    `  heroLogo: { width: 30, height: 35, tintColor: '#FFFFFF' },`,
    'hero logo',
  ],
  [
    `  heroBrandInsureit: { color: '#FFFFFF', fontSize: 16, lineHeight: 18, fontWeight: '800', letterSpacing: -0.15 },`,
    `  heroBrandInsureit: { color: '#FFFFFF', fontSize: 14, lineHeight: 16, fontWeight: '800', letterSpacing: -0.08 },`,
    'brand insureit text',
  ],
  [
    `  heroBrandPartner: { color: '#F5AB2E', fontSize: 16, lineHeight: 18, fontWeight: '800', letterSpacing: -0.15 },`,
    `  heroBrandPartner: { color: '#F5AB2E', fontSize: 14, lineHeight: 16, fontWeight: '800', letterSpacing: -0.08 },`,
    'brand partner text',
  ],
  [
    `  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },`,
    `  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },`,
    'hero actions',
  ],
  [
    `  heroIconButton: { width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.26)' },`,
    `  heroIconButton: { width: 33, height: 33, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,58,120,0.34)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.90)' },`,
    'activity button',
  ],
  [
    `  heroAvatar: { width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F1FF' },`,
    `  heroAvatar: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F1FF' },`,
    'avatar',
  ],
  [
    `  heroGreeting: { zIndex: 2, position: 'absolute', left: 14, right: 92, bottom: 8 },`,
    `  heroGreeting: { zIndex: 2, position: 'absolute', left: 16, right: 82, bottom: 24 },`,
    'greeting position',
  ],
  [
    `  heroGreetingText: { color: '#FFFFFF', fontSize: 15, lineHeight: 19, fontWeight: '500', letterSpacing: -0.05, textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },`,
    `  heroGreetingText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '500', letterSpacing: -0.04, textShadowColor: 'rgba(0,0,0,0.20)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },`,
    'greeting text',
  ],
  [
    `  body: { marginTop: -10, paddingHorizontal: 14 },`,
    `  body: { marginTop: -10, paddingHorizontal: 16 },`,
    'body overlap',
  ],
  [
    `  searchShell: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D8E4F2', shadowColor: '#173B6C', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 },`,
    `  searchShell: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D8E4F2', shadowColor: '#173B6C', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },`,
    'search shell',
  ],
  [
    `  searchInput: { flex: 1, minWidth: 0, paddingVertical: 11, color: partnerTheme.colors.ink, fontSize: 12, lineHeight: 17 },`,
    `  searchInput: { flex: 1, minWidth: 0, paddingVertical: 10, color: partnerTheme.colors.ink, fontSize: 11.5, lineHeight: 16 },`,
    'search input',
  ],
  [
    `  searchDivider: { width: StyleSheet.hairlineWidth, height: 27, backgroundColor: '#D9E1EC' },`,
    `  searchDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: '#E0E6EF' },`,
    'search divider',
  ],
  [
    `  searchAction: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 2 },`,
    `  searchAction: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 1 },`,
    'search action',
  ],
  [
    `  searchActionText: { color: partnerTheme.colors.brand, fontSize: 11.5, lineHeight: 15, fontWeight: '700' },`,
    `  searchActionText: { color: partnerTheme.colors.brand, fontSize: 10, lineHeight: 13, fontWeight: '700' },`,
    'search action text',
  ],
];

for (const [before, after, label] of styleReplacements) {
  replaceOnce(before, after, label);
}

fs.writeFileSync(target, source);
