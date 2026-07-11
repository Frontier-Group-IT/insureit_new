import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/first-look';
import { palette } from '@/lib/theme';

const shieldWatermark = require('../assets/auth/shield-watermark.png');
const waveTopRight = require('../assets/auth/wave-top-right.png');
const waveBottomLeft = require('../assets/auth/wave-bottom-left.png');
const payChallanLogo = require('../assets/auth/pay-challan-logo.png');
const getQuoteLogo = require('../assets/auth/get-quote-logo.png');

type AuthExperienceProps = {
  children: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  showLegal?: boolean;
};

const trustItems: { title: string; body: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tone: string; soft: string }[] = [
  { title: '100% Secure', body: 'Data protected', icon: 'shield-check-outline', tone: '#0B63CE', soft: '#E8F1FF' },
  { title: 'Trusted', body: 'Reliable support', icon: 'seal-variant', tone: '#0F9F6E', soft: '#E8F8F0' },
  { title: '24/7', body: 'Always available', icon: 'headset', tone: '#5548C8', soft: '#F0EDFF' },
  { title: 'Quick', body: 'Simple process', icon: 'lightning-bolt', tone: '#D99012', soft: '#FFF3D8' },
];

export function AuthExperience({ children, footer, compact = false, showLegal = !compact }: AuthExperienceProps) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 3400, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 3400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const floatUp = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const floatDown = float.interpolate({ inputRange: [0, 1], outputRange: [0, 9] });

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
            <Animated.View style={[styles.floatGlowOne, { transform: [{ translateY: floatUp }] }]} />
            <Animated.View style={[styles.floatGlowTwo, { transform: [{ translateY: floatDown }] }]} />
            <DotPattern />
          </View>

          <View style={[styles.hero, compact && styles.heroCompact]}>
            {!compact ? (
              <>
                <BrandLogo width={206} style={styles.heroLogo} />
                <Text style={styles.heroHeadline} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                  All Your Insurance Needs <Text style={styles.heroHeadlineAccent}>In One Place</Text>
                </Text>
                <View style={styles.heroDivider}>
                  <View style={styles.dividerLine} />
                  <MaterialCommunityIcons name="shield-check-outline" size={22} color="#0B63CE" />
                  <View style={styles.dividerLine} />
                </View>
              </>
            ) : (
              <Text style={styles.compactSubtitle}>Secure insurance access, made simple.</Text>
            )}
          </View>

          <View style={styles.formArea}>{children}</View>
          {footer ? <View style={styles.footerArea}>{footer}</View> : null}
          {!compact ? (
            <>
              <GuestDivider />
              <ServicePlaceholderRow />
              <TrustBadgeGrid />
              <Text style={styles.bottomSubtitle}>One platform. Multiple solutions. Complete protection.</Text>
            </>
          ) : null}
          {showLegal ? <LegalFooter /> : null}
          {!compact ? <CopyrightFooter /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LegalFooter() {
  return (
    <View style={styles.legalFooter}>
      <View style={styles.legalGlow} />
      <Text style={styles.legalPrimary}>Copyright 2026 Sankalp Insurance Brokers Pvt. Ltd. All rights reserved.</Text>
      <View style={styles.legalVersionRow}>
        <Text style={styles.legalVersion}>InsureIT v1.0.0</Text>
        <View style={styles.legalDot} />
        <Text style={styles.legalPromise}>Your Safety, Our Promise.</Text>
      </View>
    </View>
  );
}

function CopyrightFooter() {
  return (
    <Text style={styles.copyrightText}>Copyright - 2026 @ insureit.in | All rights reserved</Text>
  );
}

function ServicePlaceholderRow() {
  const router = useRouter();

  return (
    <View style={styles.cardRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Pay challan" onPress={() => router.push('/customer/e-challan' as Href)} style={[styles.featureTile, styles.challanFeatureTile]}>
        <Image source={payChallanLogo} resizeMode="contain" style={styles.featureLogo} />
        <View style={styles.featureCopy}>
          <Text style={styles.featureTitle}>Pay Challan</Text>
          <Text style={styles.featureBody}>Clear Challans with Expert Support</Text>
        </View>
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel="Get quote" onPress={() => router.push('/customer/insurance-quote' as Href)} style={[styles.featureTile, styles.quoteFeatureTile]}>
        <Image source={getQuoteLogo} resizeMode="contain" style={styles.featureLogo} />
        <View style={styles.featureCopy}>
          <Text style={styles.featureTitle}>Get Quote</Text>
          <Text style={styles.featureBody}>Smart Quotes from Trusted Insurers</Text>
        </View>
      </Pressable>
    </View>
  );
}

function GuestDivider() {
  return (
    <View style={styles.guestDivider}>
      <View style={styles.guestLine} />
      <Text style={styles.guestText}>OR EXPLORE AS GUEST</Text>
      <View style={styles.guestLine} />
    </View>
  );
}

export function SignupPromptCard() {
  return (
    <View style={authExperienceStyles.signupPromptCard}>
      <View style={authExperienceStyles.signupPromptIcon}>
        <MaterialCommunityIcons name="account-plus-outline" size={22} color="#0B63CE" />
      </View>
      <Text style={authExperienceStyles.signupPromptText}>New here? Sign up with your mobile number in a few seconds.</Text>
      <View style={authExperienceStyles.signupPromptButton}>
        <Text style={authExperienceStyles.signupPromptButtonText}>Sign up</Text>
      </View>
    </View>
  );
}

export function LoginPromptCard() {
  return (
    <View style={authExperienceStyles.signupPromptCard}>
      <View style={authExperienceStyles.signupPromptIcon}>
        <MaterialCommunityIcons name="login" size={22} color="#0B63CE" />
      </View>
      <Text style={authExperienceStyles.signupPromptText}>Already registered? Login with your mobile number.</Text>
      <View style={authExperienceStyles.signupPromptButton}>
        <Text style={authExperienceStyles.signupPromptButtonText}>Login</Text>
      </View>
    </View>
  );
}

function TrustBadgeGrid() {
  return (
    <View style={styles.trustGrid}>
      {trustItems.map((item) => (
        <View key={item.title} style={styles.trustItem}>
          <View style={styles.trustIcon}>
            <MaterialCommunityIcons name={item.icon} size={15} color={item.tone} />
          </View>
          <View style={styles.trustCopy}>
            <Text style={styles.trustTitle}>{item.title}</Text>
            <Text style={styles.trustBody} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{item.body}</Text>
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
  ctaCard: { minHeight: 82, borderRadius: 20, borderWidth: 1, borderColor: '#BFD7F7', backgroundColor: '#F8FBFF', paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#0B63CE', shadowOpacity: 0.09, shadowRadius: 14, elevation: 3 },
  ctaIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CFE2FF' },
  ctaCopy: { flex: 1, minWidth: 0 },
  ctaTitle: { color: '#071D49', fontSize: 15.5, fontWeight: '800' },
  ctaBody: { color: '#59687A', fontSize: 12.2, lineHeight: 16, fontWeight: '500', marginTop: 2 },
  ctaButton: { minHeight: 42, borderRadius: 14, backgroundColor: '#071D49', paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  ctaButtonText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800', textTransform: 'uppercase' },
  copyText: { color: '#59687A', fontSize: 13.5, lineHeight: 20, fontWeight: '600', textAlign: 'center', marginBottom: 14 },
  signupPromptCard: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: '#CFE2FF', backgroundColor: '#F8FBFF', paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9, shadowColor: '#0B63CE', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  signupPromptIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#EAF3FF', borderWidth: 1, borderColor: '#CFE2FF', alignItems: 'center', justifyContent: 'center' },
  signupPromptText: { flex: 1, minWidth: 0, color: '#344B67', fontSize: 12, lineHeight: 15, fontWeight: '500' },
  signupPromptButton: { minHeight: 34, borderRadius: 12, backgroundColor: '#071D49', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  signupPromptButtonText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase' },
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
  heroLogo: { alignSelf: 'center', marginBottom: 6 },
  heroHeadline: { alignSelf: 'stretch', color: '#071D49', fontSize: 19.5, lineHeight: 25, fontWeight: '900', textAlign: 'center', letterSpacing: 0 },
  heroHeadlineAccent: { color: '#075EEA', fontWeight: '900' },
  heroDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 14 },
  dividerLine: { width: 54, height: 1.5, borderRadius: 99, backgroundColor: '#D7A23A' },
  heroSubtitle: { color: palette.slate, fontSize: 12.6, lineHeight: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  compactSubtitle: { color: palette.slate, fontSize: 13.5, lineHeight: 19, fontWeight: '800', textAlign: 'center', marginTop: -3, marginBottom: 18 },
  guestDivider: { zIndex: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 14, marginBottom: 10, paddingHorizontal: 10 },
  guestLine: { width: 38, height: 1, backgroundColor: '#AEB8C6' },
  guestText: { color: '#8A94A6', fontSize: 11.5, lineHeight: 15, fontWeight: '600', letterSpacing: 0 },
  cardRow: { zIndex: 3, flexDirection: 'row', gap: 14, width: '100%', marginBottom: 14 },
  featureTile: { flex: 1, minHeight: 146, borderRadius: 18, paddingHorizontal: 9, paddingTop: 6, paddingBottom: 11, overflow: 'hidden', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.2, backgroundColor: '#FFFFFF', shadowColor: '#071D49', shadowOpacity: 0.12, shadowRadius: 15, elevation: 4 },
  challanFeatureTile: { borderColor: '#9FC2F4' },
  quoteFeatureTile: { borderColor: '#9CDDBF' },
  featureLogo: { width: '100%', height: 86, opacity: 0.98, marginBottom: 1 },
  featureCopy: { minWidth: 0, alignItems: 'center' },
  featureTitle: { color: '#071D49', fontSize: 15.8, lineHeight: 20, fontWeight: '900', textAlign: 'center' },
  featureBody: { color: '#59687A', fontSize: 9.2, lineHeight: 12, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  servicePlaceholder: { flex: 1, minHeight: 90, borderRadius: 15, borderWidth: 1.4, borderStyle: 'dashed', borderColor: '#BFD7F7', backgroundColor: 'rgba(255,255,255,0.54)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  placeholderIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EAF3FF', borderWidth: 1, borderColor: '#CFE2FF', alignItems: 'center', justifyContent: 'center' },
  formArea: { zIndex: 3 },
  footerArea: { zIndex: 3, marginTop: 10 },
  bottomSubtitle: { zIndex: 3, color: palette.slate, fontSize: 11.8, lineHeight: 16, fontWeight: '600', textAlign: 'center', marginTop: 9 },
  trustGrid: { zIndex: 3, borderTopWidth: 1, borderTopColor: 'rgba(207,220,235,0.9)', marginTop: 13, paddingTop: 10, flexDirection: 'row', flexWrap: 'nowrap', gap: 7 },
  trustItem: { flex: 1, minWidth: 0, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2, paddingVertical: 5 },
  trustIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  trustCopy: { minWidth: 0, alignItems: 'center' },
  trustTitle: { color: '#071D49', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  trustBody: { color: '#59687A', fontSize: 8.2, lineHeight: 10, fontWeight: '500', textAlign: 'center', marginTop: 1 },
  legalFooter: { zIndex: 3, marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(205,222,242,0.9)', backgroundColor: 'rgba(255,255,255,0.72)', paddingVertical: 11, paddingHorizontal: 12, overflow: 'hidden', alignItems: 'center' },
  legalGlow: { position: 'absolute', width: 210, height: 70, borderRadius: 80, backgroundColor: 'rgba(11,99,206,0.08)', top: -34, alignSelf: 'center' },
  legalPrimary: { color: '#344B67', fontSize: 10.3, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
  legalVersionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 4 },
  legalVersion: { color: '#071D49', fontSize: 10.5, fontWeight: '900' },
  legalDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D7A23A' },
  legalPromise: { color: '#0B63CE', fontSize: 10.5, fontWeight: '900' },
  copyrightText: { zIndex: 3, color: '#7A8797', fontSize: 9.4, lineHeight: 13, fontWeight: '500', textAlign: 'center', marginTop: 10, marginBottom: 2 },
  floatGlowOne: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(15,159,110,0.08)', left: 14, top: 250 },
  floatGlowTwo: { position: 'absolute', width: 118, height: 118, borderRadius: 59, backgroundColor: 'rgba(11,99,206,0.08)', right: 18, top: 360 },
});
