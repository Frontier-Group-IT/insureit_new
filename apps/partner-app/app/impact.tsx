import { useCallback, useEffect, useState } from 'react';
import { Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { formatIndianCurrency } from '@/lib/format';
import { getPartnerImpact, type PartnerImpactData } from '@/lib/impact';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

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

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PartnerScreen eyebrow="MY IMPACT" title="Protection delivered" onBack={() => router.back()}>
      {loading ? (
        <PartnerStateView state="loading" title="Loading your impact" />
      ) : error || !data ? (
        <PartnerStateView state="error" title="Your impact is temporarily unavailable" message={error || 'Your impact could not be loaded.'} actionLabel="Try again" onAction={() => void load()} />
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>ACTIVE MOTOR PROTECTION</Text>
            <Text style={styles.heroValue}>{formatIndianCurrency(data.active_motor_idv)}</Text>
            <Text style={styles.heroLabel}>Insured value currently protected in your Motor book.</Text>
          </View>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Protection footprint</Text></View>
          <View style={styles.grid}>
            <ImpactCard asset={PartnerAssets.products.motorInsurance} value={data.active_vehicles} label="Vehicles covered" />
            <ImpactCard asset={PartnerAssets.navigation.customers} value={data.customers_served} label="Customers served" />
          </View>
          <View style={styles.grid}>
            <ImpactCard asset={PartnerAssets.navigation.policies} value={data.lifetime_policies} label="Policies in your book" />
            <ImpactCard asset={PartnerAssets.navigation.claims} value={data.claims_assisted} label="Claims assisted" />
          </View>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>This month</Text></View>
          <View style={styles.monthCard}>
            <MonthStat label="Gross premium" value={formatIndianCurrency(data.gross_premium_this_month)} />
            <MonthStat label="Policies" value={String(data.policies_this_month)} />
            <MonthStat label="Customers added" value={String(data.customers_this_month)} />
          </View>

          {Number(data.claim_settlement_value || 0) > 0 ? (
            <View style={styles.settlementCard}>
              <View style={styles.settlementArtwork}><Image source={PartnerAssets.status.verified} style={styles.settlementArtworkImage} resizeMode="contain" /></View>
              <View style={styles.settlementBody}>
                <Text style={styles.settlementEyebrow}>CLAIM OUTCOMES</Text>
                <Text style={styles.settlementValue}>{formatIndianCurrency(data.claim_settlement_value)}</Text>
                <Text style={styles.settlementText}>Settlement value recorded across completed or assisted claims.</Text>
              </View>
            </View>
          ) : null}

          <Pressable onPress={() => router.push('/journey')} style={styles.journeyLink} accessibilityRole="button" accessibilityLabel="See your journey">
            <View style={styles.journeyArtwork}><Image source={PartnerAssets.status.journey} style={styles.journeyArtworkImage} resizeMode="contain" /></View>
            <View style={styles.journeyBody}><Text style={styles.journeyTitle}>See your journey</Text></View>
            <Ionicons name="chevron-forward" size={17} color="#9AA3B2" />
          </Pressable>
        </>
      )}
    </PartnerScreen>
  );
}

function ImpactCard({ asset, value, label }: { asset: ImageSourcePropType; value: number; label: string }) {
  return (
    <View style={styles.impactCard}>
      <View style={styles.impactArtwork}><Image source={asset} style={styles.impactArtworkImage} resizeMode="contain" /></View>
      <Text style={styles.impactValue}>{value}</Text>
      <Text style={styles.impactLabel}>{label}</Text>
    </View>
  );
}

function MonthStat({ label, value }: { label: string; value: string }) {
  return <View style={styles.monthStat}><Text style={styles.monthValue}>{value}</Text><Text style={styles.monthLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  hero: { borderRadius: partnerTheme.radius.xl, padding: 14, backgroundColor: partnerTheme.colors.nav },
  heroEyebrow: { color: '#8FD1CE', letterSpacing: 1.1, ...partnerTheme.typography.meta },
  heroValue: { marginTop: 5, color: '#FFFFFF', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  heroLabel: { marginTop: 4, maxWidth: 310, color: '#C9D0DE', ...partnerTheme.typography.caption },
  sectionHeader: { marginTop: 15, marginBottom: 7 },
  sectionTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.sectionTitle },
  grid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  impactCard: { flex: 1, minHeight: 110, borderRadius: partnerTheme.radius.lg, padding: 14, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  impactArtwork: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  impactArtworkImage: { width: 40, height: 40 },
  impactValue: { marginTop: 7, color: partnerTheme.colors.ink, fontSize: 20, lineHeight: 25, fontWeight: '800' },
  impactLabel: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  monthCard: { flexDirection: 'row', borderRadius: partnerTheme.radius.lg, paddingVertical: 12, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  monthStat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  monthValue: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  monthLabel: { marginTop: 4, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
  settlementCard: { marginTop: 9, flexDirection: 'row', gap: 12, borderRadius: partnerTheme.radius.lg, padding: 14, backgroundColor: partnerTheme.colors.accentSoft },
  settlementArtwork: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  settlementArtworkImage: { width: 42, height: 42 },
  settlementBody: { flex: 1 },
  settlementEyebrow: { color: '#3C7B78', letterSpacing: 0.8, ...partnerTheme.typography.meta },
  settlementValue: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  settlementText: { marginTop: 3, color: '#56716F', ...partnerTheme.typography.caption },
  journeyLink: { marginTop: 10, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: partnerTheme.radius.lg, paddingHorizontal: 14, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  journeyArtwork: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  journeyArtworkImage: { width: 38, height: 38 },
  journeyBody: { flex: 1 },
  journeyTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
});
