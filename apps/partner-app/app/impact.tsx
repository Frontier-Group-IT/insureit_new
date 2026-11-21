import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { formatIndianCurrency } from '@/lib/format';
import { getPartnerImpact, type PartnerImpactData } from '@/lib/impact';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

type ImpactArt = 'motor' | 'vehicle' | 'customer' | 'policy' | 'monthly-policy' | 'claim' | 'premium' | 'new-customer' | 'settlement' | 'journey';

const IMPACT_ART: Record<ImpactArt, ImageSourcePropType> = {
  motor: PartnerAssets.actions.impactBlue3dCar,
  vehicle: PartnerAssets.actions.impactBlue3dCar,
  customer: PartnerAssets.actions.impactCustomerDetail,
  policy: PartnerAssets.actions.impactPolicyDocument,
  'monthly-policy': PartnerAssets.actions.impactAddPolicy,
  claim: PartnerAssets.actions.quickClaims,
  premium: PartnerAssets.actions.businessPerformance,
  'new-customer': PartnerAssets.actions.impactCustomerAdded,
  settlement: PartnerAssets.status.verified,
  journey: PartnerAssets.status.journey,
};

// Abbreviated amounts are presentational; the existing RPC remains the source of truth.
function shortCurrency(value: number | string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return formatIndianCurrency(value);
  const absolute = Math.abs(amount);
  if (absolute >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (absolute >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  return formatIndianCurrency(value);
}

function count(value: number): string {
  return Number(value ?? 0).toLocaleString('en-IN');
}

export default function ImpactScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerImpact());
    } catch {
      setError('Your impact could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <PartnerScreen
      title="Protection delivered"
      hideTopBar
      navyStatusBar
      bottomNavigationNavy
      bottomNavigation={<PartnerCaseBottomNavigation activeTab="Home" />}
    >
      <View style={styles.pageHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Ionicons name="stats-chart-outline" size={23} color="#FFFFFF" />
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle} numberOfLines={1}>Protection delivered</Text>
        </View>
      </View>

      {loading ? (
        <PartnerStateView state="loading" title="Loading your impact" />
      ) : error || !data ? (
        <PartnerStateView state="error" title="Your impact is temporarily unavailable" message={error || 'Your impact could not be loaded.'} actionLabel="Try again" onAction={() => void load()} />
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open business performance"
            onPress={() => router.push('/(tabs)/business')}
            style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
          >
            <View style={styles.heroCar}>
              <ImpactIcon art="motor" size={76} plain />
              <View pointerEvents="none" style={styles.heroShield}>
                <Ionicons name="shield-checkmark" size={22} color="#3379E6" />
              </View>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroDetails}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroValueGroup}>
                  <Text style={styles.heroEyebrow} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>Total Protection Value</Text>
                  <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                    {shortCurrency(data.active_motor_idv)}
                  </Text>
                </View>
                <View pointerEvents="none" style={styles.heroCoverageBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#2566CF" />
                  <Text style={styles.heroCoverageText} numberOfLines={2}>Your coverage{'\n'}this month</Text>
                </View>
              </View>
            </View>
          </Pressable>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Protection footprint</Text></View>
          <View style={styles.footprintCard}>
            <ImpactCard art="vehicle" value={data.active_vehicles} label="Vehicles covered" onPress={() => router.push('/customers')} />
            <View style={styles.footprintDivider} accessible={false}/>
            <ImpactCard art="customer" value={data.customers_served} label="Customers served" onPress={() => router.push('/customers')} />
            <View style={styles.footprintDivider} accessible={false}/>
            <ImpactCard art="policy" value={data.lifetime_policies} label="Policies in your book" onPress={() => router.push('/(tabs)/policies')} />
            <View style={styles.footprintDivider} accessible={false}/>
            <ImpactCard art="claim" value={data.claims_assisted} label="Claims assisted" onPress={() => router.push('/(tabs)/claims')} />
          </View>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>This month</Text></View>
          <View style={styles.monthCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open monthly gross premium report"
              onPress={() => router.push('/business-report')}
              style={({ pressed }) => [styles.monthPremium, pressed && styles.monthStatPressed]}
            >
              <View style={styles.monthPremiumTop}>
                <View style={styles.premiumIconLabel}>
                  <ImpactIcon art="premium" size={49} plain />
                </View>
                <View style={styles.premiumDetails}>
                  <Text style={styles.premiumLabel}>Gross premium</Text>
                  <Text style={styles.premiumValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                    {shortCurrency(data.gross_premium_this_month)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#8A98AD" />
              </View>
            </Pressable>
            <View style={styles.monthDivider} />
            <View style={styles.monthStatsRow}>
              <MonthStat art="monthly-policy" label="Policies" value={count(data.policies_this_month)} onPress={() => router.push('/(tabs)/policies')} />
              <View style={styles.monthStatDivider} />
              <MonthStat art="new-customer" label="Customers added" value={count(data.customers_this_month)} onPress={() => router.push('/customers')} />
            </View>
          </View>

          {Number(data.claim_settlement_value || 0) > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open claim outcomes"
              onPress={() => router.push('/(tabs)/claims')}
              style={({ pressed }) => [styles.settlementCard, pressed && styles.pressed]}
            >
              <ImpactIcon art="settlement" size={44} />
              <View style={styles.settlementBody}>
                <Text style={styles.settlementEyebrow}>CLAIM OUTCOMES</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.settlementValue}>{formatIndianCurrency(data.claim_settlement_value)}</Text>
                <Text style={styles.settlementText}>Settlement value across completed or assisted claims</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="#6F879D" />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => router.push('/journey')}
            style={({ pressed }) => [styles.journeyLink, pressed && styles.journeyPressed]}
            accessibilityRole="button"
            accessibilityLabel="See your journey, milestones and achievements"
          >
            <View pointerEvents="none" style={styles.journeyScenery}>
              <View style={styles.journeyGlow} />
              <View style={styles.journeyRoadShadow} />
              <View style={styles.journeyRoad} />
              <View style={styles.journeyRoadTop} />
              <View style={[styles.journeyRoadMark, styles.journeyRoadMarkOne]} />
              <View style={[styles.journeyRoadMark, styles.journeyRoadMarkTwo]} />
              <View style={[styles.journeyRoadMark, styles.journeyRoadMarkThree]} />
            </View>
            <View style={styles.journeyIconCircle}>
              <Image source={IMPACT_ART.journey} resizeMode="contain" style={styles.journeyIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            </View>
            <View style={styles.journeyBody}>
              <Text style={styles.journeyTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>See your journey</Text>
              <Text style={styles.journeySubtitle} numberOfLines={2}>Milestones and achievements</Text>
            </View>
            <View pointerEvents="none" style={styles.journeyCarScene}>
              <Ionicons name="location-sharp" size={24} color="#6754EF" style={styles.journeyLocationPin} />
              <Image source={IMPACT_ART.motor} resizeMode="contain" style={styles.journeyBlueCar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            </View>
          </Pressable>
        </>
      )}
    </PartnerScreen>
  );
}

function ImpactCard({ art, value, label, onPress }: {
  art: ImpactArt;
  value: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.impactCard, pressed && styles.pressed]}
    >
      <View style={styles.cardContentRow}>
        <ImpactIcon art={art} size={40} plain footprint />
        <Text style={styles.impactLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
        <Text style={styles.impactValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{count(value)}</Text>
        <Ionicons name="chevron-forward" size={15} color="#9AA7BB" />
      </View>
    </Pressable>
  );
}

function MonthStat({ art, label, value, onPress }: {
  art: ImpactArt;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.monthStat, pressed && styles.monthStatPressed]}
    >
      <ImpactIcon art={art} size={54} plain />
      <View style={styles.cardDetails}>
        <Text style={styles.monthValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{value}</Text>
        <Text style={styles.monthLabel} numberOfLines={2}>{label}</Text>
      </View>
    </Pressable>
  );
}

function ImpactIcon({ art, size, plain = false, footprint = false }: {
  art: ImpactArt;
  size: number;
  plain?: boolean;
  footprint?: boolean;
}) {
  // Android's monthly Policies slot uses the bundled RGBA policy illustration
  // instead of the indexed-color transparent PNG, which can render invisibly.
  const source = Platform.OS === 'android' && art === 'monthly-policy'
    ? require('../assets/partner/actions/add-policy-reference.png')
    : IMPACT_ART[art];
  // Equal 40px footprint slots still look different because the illustrations
  // have unequal transparent padding. Normalize their visible artwork individually.
  const footprintArtworkSize: Partial<Record<ImpactArt, number>> = {
    vehicle: 37,
    customer: 40,
    policy: 40,
    claim: 31,
  };
  const artworkSize = footprint ? (footprintArtworkSize[art] ?? 36) : Math.round(size * 0.89);
  return (
    <View style={[
      styles.iconShell,
      { width: size, height: size, borderRadius: Math.round(size * 0.28) },
      plain && styles.iconShellPlain,
      footprint && styles.footprintIconSlot,
    ]}>
      <Image
        source={source}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: artworkSize, height: artworkSize }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    height: 52, marginHorizontal: -partnerTheme.spacing.lg, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0A234A',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#244269',
  },
  headerBack: { width: 32, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: -0.12 },
  hero: {
    marginHorizontal: -partnerTheme.spacing.lg, minHeight: 96,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#F0F6FF',
    borderBottomWidth: 1, borderBottomColor: '#D5DDE9',
    flexDirection: 'row', alignItems: 'center', gap: 11,
  },
  heroCar: {width: 78, height: 76, flexShrink: 0, alignItems: 'center', justifyContent: 'center'},
  heroShield: {position: 'absolute', top: 0, right: -2, backgroundColor: '#EFF6FF', borderRadius: 12},
  heroDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4, backgroundColor: '#D1DAE9' },
  heroDetails: {flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center'},
  heroTopRow: {flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'space-between'},
  heroValueGroup: {flex: 1, minWidth: 0, gap: 0},
  heroEyebrow: {color: '#576580', fontSize: 10, lineHeight: 13, fontWeight: '600'},
  heroValue: {width: '100%', color: '#11274A', fontSize: 23, lineHeight: 28, fontWeight: '800', marginTop: 0},
  heroCoverageBadge: {width: 106, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#E3EEFF'},
  heroCoverageText: {flex: 1, minWidth: 0, color: '#2566CF', fontSize: 9, lineHeight: 11, fontWeight: '600'},
  sectionHeader: { marginTop: 17, marginBottom: 9 },
  sectionTitle: { color: '#17233A', fontSize: 16, fontWeight: '800' },
  footprintCard: {backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E4E9F0'},
  footprintIconSlot: {flexShrink: 0, alignItems: 'center', justifyContent: 'center'},
  footprintDivider: {height: StyleSheet.hairlineWidth, marginHorizontal: 12, backgroundColor: '#E1E6EF'},
  impactCard: {minHeight: 49, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#FFFFFF'},
  cardContentRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  cardDetails: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 2 },
  impactValue: { color: '#17233A', fontSize: 17, lineHeight: 21, fontWeight: '800', textAlign: 'right', minWidth: 44 },
  impactLabel: { flex: 1, minWidth: 0, color: '#58657B', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  monthCard: { borderRadius: 19, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E9F0' },
  monthPremium: { paddingHorizontal: 14, paddingVertical: 8 },
  monthPremiumTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  premiumIconLabel: { justifyContent: 'center' },
  premiumDetails: { flex: 1, minWidth: 0, gap: 2 },
  premiumLabel: { color: '#17233A', fontSize: 11, fontWeight: '700' },
  premiumValue: { color: '#17233A', fontSize: 24, lineHeight: 29, fontWeight: '800' },
  monthDivider: { marginHorizontal: 14, height: StyleSheet.hairlineWidth, backgroundColor: '#E6EAF0' },
  monthStatsRow: { flexDirection: 'row', paddingVertical: 2 },
  monthStat: { flex: 1, minWidth: 0, minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, gap: 5 },
  monthStatDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#E6EAF0', marginVertical: 6 },
  monthStatPressed: { backgroundColor: '#F1F7FF' },
  monthValue: { color: '#17233A', fontSize: 19, lineHeight: 24, fontWeight: '800' },
  monthLabel: { color: '#17233A', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  settlementCard: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 13, backgroundColor: partnerTheme.colors.accentSoft },
  settlementBody: { flex: 1, minWidth: 0 },
  settlementEyebrow: { color: '#3C7B78', letterSpacing: 0.8, fontSize: 10, fontWeight: '800' },
  settlementValue: { marginTop: 3, color: '#17233A', fontSize: 17, lineHeight: 22, fontWeight: '800' },
  settlementText: { marginTop: 3, color: '#56716F', fontSize: 10.5, lineHeight: 15 },
  // Reference-inspired illustrated journey CTA. Use native layers so it stays crisp on Android/iOS.
  journeyLink: {
    marginTop: 12, minHeight: 96, overflow: 'hidden', flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 22,
    backgroundColor: '#ECECFF', borderWidth: 1.5, borderColor: '#D7D6FF',
    shadowColor: '#7771D8', shadowOpacity: 0.12, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  journeyScenery: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  journeyGlow: {
    position: 'absolute', top: -60, left: -34, width: 260, height: 210,
    borderRadius: 110, backgroundColor: '#F4F4FF', opacity: 0.92,
  },
  journeyRoadShadow: {
    position: 'absolute', width: 350, height: 140, right: -116, bottom: -96,
    backgroundColor: '#7167ED', borderRadius: 95, transform: [{ rotate: '-21deg' }], opacity: 0.24,
  },
  journeyRoad: {
    position: 'absolute', width: 345, height: 124, right: -104, bottom: -79,
    borderRadius: 95, backgroundColor: '#9994EE', transform: [{ rotate: '-21deg' }],
  },
  journeyRoadTop: {
    position: 'absolute', width: 345, height: 89, right: -82, bottom: -75,
    borderRadius: 95, backgroundColor: '#C4C1FA', transform: [{ rotate: '-21deg' }],
  },
  journeyRoadMark: {
    position: 'absolute', height: 2, width: 17, backgroundColor: '#F9F8FF',
    borderRadius: 3, transform: [{ rotate: '-22deg' }],
  },
  journeyRoadMarkOne: { bottom: 27, right: 120 },
  journeyRoadMarkTwo: { bottom: 42, right: 78 },
  journeyRoadMarkThree: { bottom: 59, right: 35 },
  journeyIconCircle: {
    width: 60, height: 60, borderRadius: 32, flexShrink: 0,
    backgroundColor: '#D9DFFF', alignItems: 'center', justifyContent: 'center',
  },
  journeyIcon: { width: 56, height: 56 },
  journeyBody: { flex: 1, minWidth: 0, paddingBottom: 0, paddingRight: 56, zIndex: 2 },
  journeyTitle: { color: '#102B5A', fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.35 },
  journeySubtitle: { color: '#405B89', fontSize: 11, lineHeight: 15, fontWeight: '600', marginTop: 4 },
  journeyCarScene: { position: 'absolute', right: 11, top: 10, width: 76, height: 64 },
  journeyBlueCar: { position: 'absolute', bottom: 0, right: 4, width: 73, height: 55 },
  journeyLocationPin: { position: 'absolute', top: 0, right: 0 },
  journeyPressed: { opacity: 0.94, transform: [{ scale: 0.987 }] },
  iconShell: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5FF',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1E9FF',
  },
  iconShellPlain: { backgroundColor: 'transparent', borderWidth: 0 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
