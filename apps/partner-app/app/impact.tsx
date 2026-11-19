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
  motor: PartnerAssets.products.motorInsurance,
  vehicle: PartnerAssets.actions.addVehicle,
  customer: PartnerAssets.actions.quickCustomers,
  policy: PartnerAssets.actions.policyChecklist,
  claim: PartnerAssets.actions.quickClaims,
  premium: PartnerAssets.actions.businessPerformance,
  'new-customer': PartnerAssets.actions.addCustomer,
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
        <Ionicons name="stats-chart-outline" size={25} color="#FFFFFF" />
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
            <ImpactIcon icon="shield-checkmark" art="motor" size={61} plain />
            <View style={styles.heroDivider} />
            <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
              {shortCurrency(data.active_motor_idv)}
            </Text>
            <Ionicons name="chevron-forward" size={19} color="#203C62" />
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
                <View style={styles.premiumIconLabel}>
                  <ImpactIcon icon="trending-up" art="premium" size={47} plain />
                  <Text style={styles.premiumLabel}>Gross premium</Text>
                </View>
                <Text style={styles.premiumValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                  {shortCurrency(data.gross_premium_this_month)}
                </Text>
                <Ionicons name="chevron-forward" size={17} color="#8A98AD" />
              </View>
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
      <View style={styles.cardContentRow}>
        <View style={styles.cardLeft}>
          <ImpactIcon icon={icon} art={art} size={46} plain />
          <Text style={styles.impactLabel} numberOfLines={2}>{label}</Text>
        </View>
        <Text style={styles.impactValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{count(value)}</Text>
      </View>
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
      <View style={styles.cardLeft}>
        <ImpactIcon icon={icon} art={art} size={43} plain />
        <Text style={styles.monthLabel} numberOfLines={2}>{label}</Text>
      </View>
      <Text style={styles.monthValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
    </Pressable>
  );
}

function ImpactIcon({ icon: _icon, art, size, plain = false }: {
  icon: keyof typeof Ionicons.glyphMap;
  art: ImpactArt;
  size: number;
  plain?: boolean;
}) {
  return (
    <View style={[
      styles.iconShell,
      { width: size, height: size, borderRadius: Math.round(size * 0.28) },
      plain && styles.iconShellPlain,
    ]}>
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
  headerTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  hero: {
    marginTop: 10, borderRadius: 20, minHeight: 94, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFE6F0',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  heroDivider: { width: StyleSheet.hairlineWidth, height: 59, backgroundColor: '#D6DEEA' },
  heroValue: { flex: 1, minWidth: 0, color: '#11274A', fontSize: 28, lineHeight: 36, fontWeight: '800' },
  sectionHeader: { marginTop: 17, marginBottom: 9 },
  sectionTitle: { color: '#17233A', fontSize: 16, fontWeight: '800' },
  grid: { flexDirection: 'row', gap: 9, marginBottom: 9 },
  impactCard: {
    flex: 1, minWidth: 0, minHeight: 105, borderRadius: 18, padding: 12,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E9F0',
  },
  cardContentRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardLeft: { flex: 1, minWidth: 0, justifyContent: 'space-between', alignSelf: 'stretch' },
  impactValue: { maxWidth: '52%', color: '#17233A', fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'right' },
  impactLabel: { color: '#17233A', fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 6 },
  monthCard: { borderRadius: 19, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E9F0' },
  monthPremium: { paddingHorizontal: 14, paddingVertical: 12 },
  monthPremiumTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  premiumIconLabel: { flex: 1, minWidth: 0, gap: 4 },
  premiumLabel: { color: '#17233A', fontSize: 11, fontWeight: '700' },
  premiumValue: { flexShrink: 1, minWidth: 0, color: '#17233A', fontSize: 25, lineHeight: 32, fontWeight: '800', textAlign: 'right' },
  monthDivider: { marginHorizontal: 14, height: StyleSheet.hairlineWidth, backgroundColor: '#E6EAF0' },
  monthStatsRow: { flexDirection: 'row', paddingVertical: 5 },
  monthStat: { flex: 1, minWidth: 0, minHeight: 87, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, gap: 4 },
  monthStatDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#E6EAF0', marginVertical: 6 },
  monthStatPressed: { backgroundColor: '#F1F7FF' },
  monthValue: { maxWidth: '52%', color: '#17233A', fontSize: 19, lineHeight: 24, fontWeight: '800', textAlign: 'right' },
  monthLabel: { color: '#17233A', fontSize: 10, lineHeight: 14, fontWeight: '700', marginTop: 5 },
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
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5FF',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1E9FF',
  },
  iconShellPlain: { backgroundColor: 'transparent', borderWidth: 0 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
