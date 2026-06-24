import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Image, ImageSourcePropType, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/first-look';
import { palette } from '@/lib/theme';

const shieldWatermark = require('../assets/auth/shield-watermark.png');
const waveTopRight = require('../assets/auth/wave-top-right.png');
const waveBottomLeft = require('../assets/auth/wave-bottom-left.png');
const twoWheeler = require('../assets/auth/two-wheeler-insurance.png');
const car = require('../assets/auth/car-insurance.png');
const truck = require('../assets/auth/truck-insurance.png');
const health = require('../assets/auth/health-insurance.png');
const life = require('../assets/auth/life-insurance.png');

type AuthExperienceProps = {
  children: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  showLegal?: boolean;
};

const insuranceCards: { title: string; subtitle: string; image: ImageSourcePropType }[] = [
  { title: 'Two Wheeler', subtitle: 'Insurance', image: twoWheeler },
  { title: 'Private Car', subtitle: 'Insurance', image: car },
  { title: 'Truck', subtitle: 'Insurance', image: truck },
  { title: 'Health', subtitle: 'Insurance', image: health },
  { title: 'Life', subtitle: 'Insurance', image: life },
];

const trustItems: { title: string; body: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tone: string; soft: string }[] = [
  { title: '100% Secure', body: 'Your data is safe with us', icon: 'shield-check-outline', tone: '#0B63CE', soft: '#E8F1FF' },
  { title: 'Trusted by Thousands', body: 'Reliable & dependable', icon: 'seal-variant', tone: '#0F9F6E', soft: '#E8F8F0' },
  { title: '24/7 Support', body: "We're here to help you", icon: 'headset', tone: '#5548C8', soft: '#F0EDFF' },
  { title: 'Quick & Easy', body: 'Simple, fast & hassle-free', icon: 'lightning-bolt', tone: '#D99012', soft: '#FFF3D8' },
];

export function AuthExperience({ children, footer, compact = false, showLegal = !compact }: AuthExperienceProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.content, compact && styles.contentCompact]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.backdrop}>
            <Image source={waveTopRight} resizeMode="contain" style={styles.waveTopRight} />
            <Image source={waveBottomLeft} resizeMode="contain" style={styles.waveBottomLeft} />
            <Image source={shieldWatermark} resizeMode="contain" style={styles.shieldWatermark} />
            <DotPattern />
          </View>

          <View style={[styles.hero, compact && styles.heroCompact]}>
            {!compact ? (
              <>
                <BrandLogo width={206} style={styles.heroLogo} />
                <Text style={styles.heroTitle}>All Your Insurance Needs,</Text>
                <Text style={styles.heroTitleAccent}>All in One Place</Text>
                <View style={styles.heroDivider}>
                  <View style={styles.dividerLine} />
                  <MaterialCommunityIcons name="shield-check-outline" size={22} color="#0B63CE" />
                  <View style={styles.dividerLine} />
                </View>
                <Text style={styles.heroSubtitle}>One platform. Multiple solutions. Complete protection.</Text>
                <InsuranceCardRow />
              </>
            ) : (
              <Text style={styles.compactSubtitle}>Secure insurance access, made simple.</Text>
            )}
          </View>

          <View style={styles.formArea}>{children}</View>
          {footer ? <View style={styles.footerArea}>{footer}</View> : null}
          {!compact ? <TrustBadgeGrid /> : null}
          {showLegal ? <LegalFooter /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LegalFooter() {
  return (
    <View style={styles.legalFooter}>
      <View style={styles.legalGlow} />
      <Text style={styles.legalPrimary}>© 2026 Sankalp Insurance Brokers Pvt. Ltd. All rights reserved.</Text>
      <View style={styles.legalVersionRow}>
        <Text style={styles.legalVersion}>InsureIT v1.0.0</Text>
        <View style={styles.legalDot} />
        <Text style={styles.legalPromise}>Your Safety, Our Promise.</Text>
      </View>
    </View>
  );
}

function InsuranceCardRow() {
  return (
    <View style={styles.cardRow}>
      {insuranceCards.map((item) => (
        <View key={item.title} style={styles.insuranceCard}>
          <View style={styles.cardShield}>
            <MaterialCommunityIcons name="shield-check" size={15} color="#FFFFFF" />
          </View>
          <Image source={item.image} resizeMode="contain" style={styles.cardImage} />
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
        </View>
      ))}
    </View>
  );
}

function TrustBadgeGrid() {
  return (
    <View style={styles.trustGrid}>
      {trustItems.map((item) => (
        <View key={item.title} style={styles.trustItem}>
          <View style={[styles.trustIcon, { backgroundColor: item.soft }]}>
            <MaterialCommunityIcons name={item.icon} size={23} color={item.tone} />
          </View>
          <View style={styles.trustCopy}>
            <Text style={styles.trustTitle}>{item.title}</Text>
            <Text style={styles.trustBody}>{item.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function DotPattern() {
  const dots = Array.from({ length: 70 });
  return (
    <View pointerEvents="none" style={styles.dotPattern}>
      {dots.map((_, index) => (
        <View key={index} style={[styles.dot, { opacity: Math.max(0.08, 0.5 - index * 0.005) }]} />
      ))}
    </View>
  );
}

export const authExperienceStyles = StyleSheet.create({
  panelLogo: { alignSelf: 'center', marginBottom: 8 },
  secureRow: { alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  secureCopy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secureText: { color: '#0F9F6E', fontSize: 16, fontWeight: '900' },
  helperLink: { alignSelf: 'flex-end', minHeight: 34, justifyContent: 'center', marginTop: -8, marginBottom: 6 },
  helperLinkText: { color: '#0B63CE', fontSize: 13, fontWeight: '800' },
  ctaCard: { minHeight: 72, borderRadius: 22, borderWidth: 1, borderColor: '#E1E8F0', backgroundColor: '#FFFFFF', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 13, shadowColor: '#17202F', shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  ctaIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  ctaCopy: { flex: 1, minWidth: 0 },
  ctaTitle: { color: '#071D49', fontSize: 15, fontWeight: '900' },
  ctaBody: { color: '#59687A', fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  ctaButton: { minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: '#0B63CE', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  ctaButtonText: { color: '#0B63CE', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  copyText: { color: '#59687A', fontSize: 13.5, lineHeight: 20, fontWeight: '600', textAlign: 'center', marginBottom: 14 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F9FF' },
  keyboard: { flex: 1 },
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 28 },
  contentCompact: { justifyContent: 'center', paddingBottom: 30 },
  backdrop: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  waveTopRight: { position: 'absolute', top: -36, right: -88, width: 360, height: 230, opacity: 0.92 },
  waveBottomLeft: { position: 'absolute', left: -74, bottom: -54, width: 358, height: 248, opacity: 0.95 },
  shieldWatermark: { position: 'absolute', right: -12, top: 138, width: 126, height: 126, opacity: 0.36 },
  dotPattern: { position: 'absolute', left: -8, top: 6, width: 210, height: 116, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#7AB8F5' },
  hero: { alignItems: 'center', zIndex: 2 },
  heroCompact: { marginBottom: 8 },
  heroLogo: { alignSelf: 'center', marginBottom: 7 },
  heroTitle: { color: '#071D49', fontSize: 21.5, lineHeight: 27, fontWeight: '900', textAlign: 'center' },
  heroTitleAccent: { color: '#075EEA', fontSize: 23.5, lineHeight: 29, fontWeight: '900', textAlign: 'center' },
  heroDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 7, marginBottom: 7 },
  dividerLine: { width: 54, height: 1.5, borderRadius: 99, backgroundColor: '#D7A23A' },
  heroSubtitle: { color: palette.slate, fontSize: 12.6, lineHeight: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  compactSubtitle: { color: palette.slate, fontSize: 13.5, lineHeight: 19, fontWeight: '800', textAlign: 'center', marginTop: -3, marginBottom: 18 },
  cardRow: { flexDirection: 'row', gap: 6, width: '100%', marginBottom: 13 },
  insuranceCard: { flex: 1, minHeight: 112, borderRadius: 15, borderWidth: 1, borderColor: '#D8E5F2', backgroundColor: 'rgba(255,255,255,0.84)', alignItems: 'center', paddingTop: 11, paddingHorizontal: 2, overflow: 'hidden' },
  cardShield: { position: 'absolute', top: 8, width: 24, height: 24, borderRadius: 10, backgroundColor: '#0B63CE', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  cardImage: { width: '100%', height: 54, marginTop: 10 },
  cardTitle: { color: '#075EEA', fontSize: 9.4, lineHeight: 11, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  cardSubtitle: { color: '#17202F', fontSize: 9.4, lineHeight: 11, fontWeight: '700', textAlign: 'center', marginTop: 1 },
  formArea: { zIndex: 3 },
  footerArea: { zIndex: 3, marginTop: 10 },
  trustGrid: { zIndex: 3, borderTopWidth: 1, borderTopColor: 'rgba(207,220,235,0.9)', marginTop: 14, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trustItem: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 62 },
  trustIcon: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  trustCopy: { flex: 1, minWidth: 0 },
  trustTitle: { color: '#071D49', fontSize: 12, fontWeight: '900' },
  trustBody: { color: '#59687A', fontSize: 10.5, lineHeight: 14, fontWeight: '600', marginTop: 2 },
  legalFooter: { zIndex: 3, marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(205,222,242,0.9)', backgroundColor: 'rgba(255,255,255,0.72)', paddingVertical: 11, paddingHorizontal: 12, overflow: 'hidden', alignItems: 'center' },
  legalGlow: { position: 'absolute', width: 210, height: 70, borderRadius: 80, backgroundColor: 'rgba(11,99,206,0.08)', top: -34, alignSelf: 'center' },
  legalPrimary: { color: '#344B67', fontSize: 10.3, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
  legalVersionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 4 },
  legalVersion: { color: '#071D49', fontSize: 10.5, fontWeight: '900' },
  legalDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D7A23A' },
  legalPromise: { color: '#0B63CE', fontSize: 10.5, fontWeight: '900' },
});
