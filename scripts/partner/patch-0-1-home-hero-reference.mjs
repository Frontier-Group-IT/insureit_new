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
  `              accessibilityLabel="View recent activity"\n                onPress={() => router.push('/activity')}\n                style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}\n              >\n                <Feather name="clock" size={18} color="#FFFFFF" />`,
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
    `  hero: { height: 168, overflow: 'hidden', backgroundColor: '#0757AE', paddingTop: 28 },`,
    'hero sizing',
  ],
  [
    `  heroBackdrop: { ...StyleSheet.absoluteFillObject, opacity: 1 },`,
    `  heroBackdrop: { position: 'absolute', left: 0, right: 0, top: -22, width: '100%', height: 210, opacity: 1 },`,
    'hero artwork framing',
  ],
  [
    `  heroBackdropShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,34,75,0.06)' },`,
    `  heroBackdropShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,42,93,0.04)' },`,
    'hero shade',
  ],
  [
    `  heroTopRow: { zIndex: 2, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 14 },`,
    `  heroTopRow: { zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },`,
    'hero top row',
  ],
  [
    `  heroBrand: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, maxWidth: '60%' },`,
    `  heroBrand: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '62%' },`,
    'hero brand row',
  ],
  [
    `  heroLogo: { width: 33, height: 39, tintColor: '#FFFFFF' },`,
    `  heroLogo: { width: 34, height: 40, tintColor: '#FFFFFF' },`,
    'hero logo',
  ],
  [
    `  heroBrandInsureit: { color: '#FFFFFF', fontSize: 16, lineHeight: 18, fontWeight: '800', letterSpacing: -0.15 },`,
    `  heroBrandInsureit: { color: '#FFFFFF', fontSize: 15, lineHeight: 17, fontWeight: '800', letterSpacing: -0.1 },`,
    'brand insureit text',
  ],
  [
    `  heroBrandPartner: { color: '#F5AB2E', fontSize: 16, lineHeight: 18, fontWeight: '800', letterSpacing: -0.15 },`,
    `  heroBrandPartner: { color: '#F5AB2E', fontSize: 15, lineHeight: 17, fontWeight: '800', letterSpacing: -0.1 },`,
    'brand partner text',
  ],
  [
    `  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },`,
    `  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },`,
    'hero actions',
  ],
  [
    `  heroIconButton: { width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.26)' },`,
    `  heroIconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.88)' },`,
    'activity button',
  ],
  [
    `  heroAvatar: { width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F1FF' },`,
    `  heroAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F1FF' },`,
    'avatar',
  ],
  [
    `  heroGreeting: { zIndex: 2, position: 'absolute', left: 14, right: 92, bottom: 8 },`,
    `  heroGreeting: { zIndex: 2, position: 'absolute', left: 16, right: 76, bottom: 17 },`,
    'greeting position',
  ],
  [
    `  heroGreetingText: { color: '#FFFFFF', fontSize: 15, lineHeight: 19, fontWeight: '500', letterSpacing: -0.05, textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },`,
    `  heroGreetingText: { color: '#FFFFFF', fontSize: 15, lineHeight: 19, fontWeight: '500', letterSpacing: -0.05, textShadowColor: 'rgba(0,0,0,0.22)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },`,
    'greeting text',
  ],
  [
    `  body: { marginTop: -10, paddingHorizontal: 14 },`,
    `  body: { marginTop: -16, paddingHorizontal: 16 },`,
    'body overlap',
  ],
  [
    `  searchShell: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D8E4F2', shadowColor: '#173B6C', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 },`,
    `  searchShell: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D8E4F2', shadowColor: '#173B6C', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },`,
    'search shell',
  ],
  [
    `  searchInput: { flex: 1, minWidth: 0, paddingVertical: 11, color: partnerTheme.colors.ink, fontSize: 12, lineHeight: 17 },`,
    `  searchInput: { flex: 1, minWidth: 0, paddingVertical: 11, color: partnerTheme.colors.ink, fontSize: 11.5, lineHeight: 16 },`,
    'search input',
  ],
  [
    `  searchDivider: { width: StyleSheet.hairlineWidth, height: 27, backgroundColor: '#D9E1EC' },`,
    `  searchDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: '#E0E6EF' },`,
    'search divider',
  ],
  [
    `  searchAction: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 2 },`,
    `  searchAction: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 1 },`,
    'search action',
  ],
  [
    `  searchActionText: { color: partnerTheme.colors.brand, fontSize: 11.5, lineHeight: 15, fontWeight: '700' },`,
    `  searchActionText: { color: partnerTheme.colors.brand, fontSize: 10.5, lineHeight: 14, fontWeight: '700' },`,
    'search action text',
  ],
];

for (const [before, after, label] of styleReplacements) {
  replaceOnce(before, after, label);
}

fs.writeFileSync(target, source);
