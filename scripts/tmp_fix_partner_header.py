from pathlib import Path

p = Path('apps/partner-app/app/(tabs)/index.tsx')
s = p.read_text()

old_brand = '''          <Image
            source={GeneratedDashboardAssets.homeHeader}
            style={styles.heroBackdrop}
            resizeMode="cover"
          />
          <View style={styles.heroBackdropShade} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroBrand}>

              <Image

                source={require('../../assets/insureit-partner-official.png')}

                style={styles.heroLogo}

                resizeMode="contain"

              />

              <View style={styles.heroBrandCopy} accessibilityLabel="insureit Partner">
                <Text style={styles.heroBrandInsureit}>insureit</Text>
                <Text style={styles.heroBrandPartner}>Partner</Text>
              </View>

            </View>
            <View style={styles.heroActions}>'''

new_brand = '''          <Image
            source={GeneratedDashboardAssets.homeHeader}
            style={styles.heroBackdrop}
            resizeMode="stretch"
          />
          <View style={styles.heroBackdropShade} />
          <Image
            source={require('../../assets/insureit-partner-official.png')}
            style={styles.heroWatermark}
            resizeMode="contain"
          />
          <View style={styles.heroTopRow}>
            <View style={styles.heroBrandCentered}>
              <Image
                source={require('../../assets/insureit-partner-official.png')}
                style={styles.heroLogoCentered}
                resizeMode="contain"
              />
              <View style={styles.heroBrandWordmark} accessibilityLabel="insureit Partner">
                <Text style={styles.heroBrandInsureit}>insureit</Text>
                <Text style={styles.heroBrandPartner}>Partner</Text>
              </View>
            </View>
            <View style={styles.heroActions}>'''

if old_brand not in s:
    raise SystemExit('Expected current hero brand block not found')
s = s.replace(old_brand, new_brand, 1)

replacements = {
    "  hero: { height: 152, overflow: 'hidden', backgroundColor: '#054D9E', paddingTop: 9 },": "  hero: { height: 188, overflow: 'hidden', backgroundColor: '#073A78', paddingTop: 8 },",
    "  heroBackdrop: { ...StyleSheet.absoluteFillObject, opacity: 1 },": "  heroBackdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },",
    "  heroBackdropShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,34,75,0.06)' },": "  heroBackdropShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,30,68,0.16)' },\n  heroWatermark: { position: 'absolute', width: 300, height: 230, left: '50%', top: 10, marginLeft: -150, opacity: 0.07, tintColor: '#FFFFFF' },",
    "  heroTopRow: { zIndex: 2, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 14 },": "  heroTopRow: { zIndex: 2, minHeight: 116, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, paddingHorizontal: 14 },",
    "  heroBrand: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, maxWidth: '60%' },": "  heroBrandCentered: { alignItems: 'center', justifyContent: 'flex-start' },",
    "  heroLogo: { width: 33, height: 39, tintColor: '#FFFFFF' },": "  heroLogoCentered: { width: 66, height: 74 },",
    "  heroBrandCopy: { paddingTop: 1 },": "  heroBrandWordmark: { marginTop: -2, flexDirection: 'row', alignItems: 'baseline', gap: 4 },",
    "  heroBrandInsureit: { color: '#FFFFFF', fontSize: 16, lineHeight: 18, fontWeight: '800', letterSpacing: -0.15 },": "  heroBrandInsureit: { color: '#FFFFFF', fontSize: 17, lineHeight: 21, fontWeight: '800', letterSpacing: -0.2 },",
    "  heroBrandPartner: { color: '#F5AB2E', fontSize: 16, lineHeight: 18, fontWeight: '800', letterSpacing: -0.15 },": "  heroBrandPartner: { color: '#F5AB2E', fontSize: 17, lineHeight: 21, fontWeight: '800', letterSpacing: -0.2 },",
    "  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },": "  heroActions: { position: 'absolute', top: 7, right: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },",
    "  heroGreeting: { zIndex: 2, position: 'absolute', left: 14, right: 92, bottom: 8 },": "  heroGreeting: { zIndex: 2, position: 'absolute', left: 18, right: 18, bottom: 18, alignItems: 'center' },",
    "  heroGreetingText: { color: '#FFFFFF', fontSize: 15, lineHeight: 19, fontWeight: '500', letterSpacing: -0.05, textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },": "  heroGreetingText: { color: '#FFFFFF', textAlign: 'center', fontSize: 19, lineHeight: 24, fontWeight: '700', letterSpacing: -0.2, textShadowColor: 'rgba(0,0,0,0.24)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },",
    "  body: { marginTop: -10, paddingHorizontal: 14 },": "  body: { marginTop: -16, paddingHorizontal: 14 },",
}
for old, new in replacements.items():
    if old not in s:
        raise SystemExit(f'Expected style not found: {old}')
    s = s.replace(old, new, 1)

p.write_text(s)
