import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { formatIndianCurrency } from '@/lib/format';
import { getPartnerImpact, type PartnerImpactData } from '@/lib/impact';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

type ImpactArt = 'motor' | 'vehicle' | 'customer' | 'policy' | 'claim' | 'premium' | 'new-customer' | 'settlement' | 'journey';

const IMPACT_ART: Record<ImpactArt, ImageSourcePropType> = {
  motor: PartnerAssets.status.verified,
  vehicle: PartnerAssets.products.motorInsurance,
  customer: PartnerAssets.actions.quickCustomers,
  policy: PartnerAssets.actions.policyChecklist,
  claim: PartnerAssets.navigation.claims,
  premium: PartnerAssets.actions.businessPerformance,
  'new-customer': PartnerAssets.actions.addCustomer,
  settlement: PartnerAssets.status.verified,
  journey: PartnerAssets.status.journey,
};

// Keep abbreviated amounts strictly presentational. Exact server values remain beneath.
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
        <Ionicons name="stats-chart-outline" size={25} color="#FFFFFF" />
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>MY IMPACT</Text>
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
            <View style={styles.heroTopRow}>
              <Text style={styles.heroEyebrow}>ACTIVE MOTOR PROTECTION</Text>
              <ImpactIcon icon="shield-checkmark" art="motor" size={44} inverse />
            </View>
            <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {shortCurrency(data.active_motor_idv)}
            </Text>
            <Text style={styles.heroExact}>{formatIndianCurrency(data.active_motor_idv)} insured value</Text>
            <View style={styles.heroBottomRow}>
              <Text style={styles.heroLabel}>Value protected across active motor policies</Text>
              <Ionicons name="arrow-forward-outline" size={19} color="#CFDBEF" />
            </View>
          </Pressable>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Protection footprint</Text></View>
          <View style={styles.grid}>
            <ImpactCard art="vehicle" icon="car-sport" value={data.active_vehicles} label="Vehicles covered" onPress={() => router.push('/customers')} />
            <ImpactCard art="customer" icon="people" value={data.customers_served} label="Customers served" onPress={() => router.push('/customers')} />
          </View>
          <View style={styles.grid}>
            <ImpactCard art="policy" icon="document-text" value={data.lifetime_policies} label="Policies in your book" onPress={() => router.push('/(tabs)/policies')} />
            <ImpactCard art="claim" icon="shield-checkmark" value={data.claims_assisted} label="Claims assisted" onPress={() => router.push('/(tabs)/claims')} />
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
                <View style={styles.monthPremiumLabel}>
                  <ImpactIcon icon="trending-up" art="premium" size={40} />
                  <Text style={styles.premiumLabel}>Gross premium</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#8A98AD" />
              </View>
              <Text style={styles.premiumValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {shortCurrency(data.gross_premium_this_month)}
              </Text>
              <Text style={styles.premiumExact}>{formatIndianCurrency(data.gross_premium_this_month)}</Text>
            </Pressable>
            <View style={styles.monthDivider} />
            <View style={styles.monthStatsRow}>
              <MonthStat icon="document-text" art="policy" label="Policies" value={count(data.policies_this_month)} onPress={() => router.push('/(tabs)/policies')} />
              <View style={styles.monthStatDivider} />
              <MonthStat icon="person-add" art="new-customer" label="Customers added" value={count(data.customers_this_month)} onPress={() => router.push('/customers')} />
            </View>
          </View>

          {Number(data.claim_settlement_value || 0) > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open claim outcomes"
              onPress={() => router.push('/(tabs)/claims')}
              style={({ pressed }) => [styles.settlementCard, pressed && styles.pressed]}
            >
              <ImpactIcon icon="checkmark-done-circle" art="settlement" size={44} />
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
            style={({ pressed }) => [styles.journeyLink, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="See your journey"
          >
            <ImpactIcon icon="navigate-circle" art="journey" size={46} />
            <View style={styles.journeyBody}>
              <Text style={styles.journeyTitle}>See your journey</Text>
              <Text style={styles.journeySubtitle}>Milestones and achievements</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#9AA3B2" />
          </Pressable>
        </>
      )}
    </PartnerScreen>
  );
}

function ImpactCard({ icon, art, value, label, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
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
      <View style={styles.cardTopRow}>
        <ImpactIcon icon={icon} art={art} size={43} />
        <Ionicons name="chevron-forward" size={16} color="#9AA3B2" />
      </View>
      <Text style={styles.impactValue} numberOfLines={1} adjustsFontSizeToFit>{count(value)}</Text>
      <Text style={styles.impactLabel}>{label}</Text>
    </Pressable>
  );
}

function MonthStat({ icon, art, label, value, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
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
      <ImpactIcon icon={icon} art={art} size={37} compact />
      <Text style={styles.monthValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.monthLabel}>{label}</Text>
    </Pressable>
  );
}

function ImpactIcon({ icon, art, size, compact = false, inverse = false }: {
  icon: keyof typeof Ionicons.glyphMap;
  art: ImpactArt;
  size: number;
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <View style={[
      styles.iconShell,
      { width: size, height: size, borderRadius: Math.round(size * 0.28) },
      compact && styles.iconShellCompact,
      inverse && styles.iconShellInverse,
    ]}>
      <View style={[styles.iconGlow, inverse && styles.iconGlowInverse]} />
      <Image
        source={IMPACT_ART[art]}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: Math.round(size * 0.89), height: Math.round(size * 0.89) }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    height: 64, marginHorizontal: -partnerTheme.spacing.lg, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#071E49',
  },
  headerBack: { width: 34, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  headerEyebrow: { color: '#B5C8E5', fontSize: 9, letterSpacing: 1.1, fontWeight: '800' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 2 },
  hero: { marginTop: 10, borderRadius: 22, padding: 17, backgroundColor: '#142849' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroEyebrow: { flex: 1, color: '#B6C6FC', letterSpacing: 1, fontSize: 10, fontWeight: '800' },
  heroValue: { marginTop: 8, color: '#FFFFFF', fontSize: 32, lineHeight: 39, fontWeight: '800' },
  heroExact: { marginTop: 3, color: '#CAD8EC', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  heroBottomRow: { marginTop: 15, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#465874', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroLabel: { flex: 1, color: '#D8E2F1', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  sectionHeader: { marginTop: 19, marginBottom: 9 },
  sectionTitle: { color: '#17233A', fontSize: 16, fontWeight: '800' },
  grid: { flexDirection: 'row', gap: 9, marginBottom: 9 },
  impactCard: { flex: 1, minWidth: 0, minHeight: 120, borderRadius: 18, padding: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E9F0' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  impactValue: { marginTop: 10, color: '#17233A', fontSize: 23, lineHeight: 28, fontWeight: '800' },
  impactLabel: { marginTop: 4, color: '#66758C', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  monthCard: { borderRadius: 19, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E9F0' },
  monthPremium: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 15 },
  monthPremiumTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthPremiumLabel: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  premiumLabel: { color: '#53647C', fontSize: 12, fontWeight: '700' },
  premiumValue: { marginTop: 9, color: '#17233A', fontSize: 26, lineHeight: 31, fontWeight: '800' },
  premiumExact: { marginTop: 3, color: '#66758C', fontSize: 11, lineHeight: 16 },
  monthDivider: { marginHorizontal: 15, height: StyleSheet.hairlineWidth, backgroundColor: '#E6EAF0' },
  monthStatsRow: { flexDirection: 'row', paddingVertical: 8 },
  monthStat: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 7 },
  monthStatDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#E6EAF0', marginVertical: 4 },
  monthStatPressed: { backgroundColor: '#F1F7FF' },
  monthValue: { marginTop: 5, color: '#17233A', fontSize: 18, lineHeight: 23, fontWeight: '800' },
  monthLabel: { marginTop: 3, color: '#66758C', textAlign: 'center', fontSize: 10.5, fontWeight: '600' },
  settlementCard: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 13, backgroundColor: partnerTheme.colors.accentSoft },
  settlementBody: { flex: 1, minWidth: 0 },
  settlementEyebrow: { color: '#3C7B78', letterSpacing: 0.8, fontSize: 10, fontWeight: '800' },
  settlementValue: { marginTop: 3, color: '#17233A', fontSize: 17, lineHeight: 22, fontWeight: '800' },
  settlementText: { marginTop: 3, color: '#56716F', fontSize: 10.5, lineHeight: 15 },
  journeyLink: { marginTop: 12, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 18, paddingHorizontal: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E9F0' },
  journeyBody: { flex: 1 },
  journeyTitle: { color: '#17233A', fontSize: 12, fontWeight: '800' },
  journeySubtitle: { color: '#66758C', fontSize: 10, marginTop: 3 },
  iconShell: {
    position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E8F5FF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1E9FF',
    shadowColor: '#0A62B8', shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  iconShellCompact: { shadowOpacity: 0.08, elevation: 1 },
  iconShellInverse: { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.18)' },
  iconGlow: { position: 'absolute', width: '72%', height: '72%', right: -5, top: -5, borderRadius: 20, backgroundColor: 'rgba(56,176,255,0.22)' },
  iconGlowInverse: { backgroundColor: 'rgba(143,209,206,0.28)' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
