import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { getPartnerImpact, type PartnerImpactData } from '@/lib/impact';
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
    <PartnerScreen
      eyebrow="MY IMPACT"
      title="Protection delivered"
      action={
        <PartnerIconButton icon="close" label="Close impact" onPress={() => router.back()} />
      }
    >
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : error || !data ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error || 'Impact is unavailable.'}</Text>
          <Pressable onPress={load}><Text style={styles.retry}>Try again</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>ACTIVE MOTOR PROTECTION</Text>
            <Text style={styles.heroValue}>{formatMoney(data.active_motor_idv)}</Text>
            <Text style={styles.heroLabel}>insured declared value currently covered in your authorized Motor book</Text>
            <View style={styles.heroRule} />
            <Text style={styles.heroNote}>We show Motor IDV separately because it has a clear insured-value meaning. Other product sums are not mixed into this number.</Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Protection footprint</Text>
          </View>

          <View style={styles.grid}>
            <ImpactCard icon="car-outline" value={data.active_vehicles} label="Vehicles currently covered" />
            <ImpactCard icon="people-outline" value={data.customers_served} label="Customers served" />
          </View>
          <View style={styles.grid}>
            <ImpactCard icon="document-text-outline" value={data.lifetime_policies} label="Policies in your book" />
            <ImpactCard icon="shield-checkmark-outline" value={data.claims_assisted} label="Claims assisted" />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This month</Text>
          </View>

          <View style={styles.monthCard}>
            <MonthStat label="Gross premium" value={formatMoney(data.gross_premium_this_month)} />
            <MonthStat label="Policies" value={String(data.policies_this_month)} />
            <MonthStat label="Customers added" value={String(data.customers_this_month)} />
          </View>

          {Number(data.claim_settlement_value || 0) > 0 ? (
            <View style={styles.settlementCard}>
              <View style={styles.settlementIcon}><Ionicons name="heart-circle-outline" size={21} color={partnerTheme.colors.accent} /></View>
              <View style={styles.settlementBody}>
                <Text style={styles.settlementEyebrow}>CLAIM OUTCOMES RECORDED</Text>
                <Text style={styles.settlementValue}>{formatMoney(data.claim_settlement_value)}</Text>
                <Text style={styles.settlementText}>settlement value recorded across completed/assisted claims in this authorized book</Text>
              </View>
            </View>
          ) : null}

          <Pressable onPress={() => router.push('/journey')} style={styles.journeyLink}>
            <View style={styles.journeyIcon}><Ionicons name="trail-sign-outline" size={20} color={partnerTheme.colors.brand} /></View>
            <View style={styles.journeyBody}>
              <Text style={styles.journeyTitle}>See your journey</Text>
              <Text style={styles.journeyText}>Turn these real business events into a timeline of progress.</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#9AA3B2" />
          </Pressable>
        </>
      )}
    </PartnerScreen>
  );
}

function ImpactCard({ icon, value, label }: {
  icon: 'car-outline' | 'people-outline' | 'document-text-outline' | 'shield-checkmark-outline';
  value: number;
  label: string;
}) {
  return (
    <View style={styles.impactCard}>
      <View style={styles.impactIcon}><Ionicons name={icon} size={18} color={partnerTheme.colors.brand} /></View>
      <Text style={styles.impactValue}>{value}</Text>
      <Text style={styles.impactLabel}>{label}</Text>
    </View>
  );
}

function MonthStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.monthStat}>
      <Text style={styles.monthValue}>{value}</Text>
      <Text style={styles.monthLabel}>{label}</Text>
    </View>
  );
}

function formatMoney(value: number | string) {
  const amount = Number(value || 0);
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(amount >= 100000000 ? 0 : 1)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)} K`;
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
}

const styles = StyleSheet.create({
  close: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  errorCard: { minHeight: 180, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface },
  errorText: { color: partnerTheme.colors.inkMuted, fontSize: 10 },
  retry: { marginTop: 10, color: partnerTheme.colors.brand, fontSize: 10, fontWeight: '800' },

  hero: { borderRadius: partnerTheme.radius.xl, padding: 21, backgroundColor: partnerTheme.colors.nav },
  heroEyebrow: { color: '#8FD1CE', fontSize: 8, fontWeight: '800', letterSpacing: 1.25 },
  heroValue: { marginTop: 7, color: '#FFFFFF', fontSize: 29, fontWeight: '800' },
  heroLabel: { marginTop: 6, maxWidth: 310, color: '#C9D0DE', fontSize: 10, lineHeight: 15 },
  heroRule: { height: StyleSheet.hairlineWidth, marginTop: 15, backgroundColor: '#394457' },
  heroNote: { marginTop: 11, color: '#9EA9BA', fontSize: 8.5, lineHeight: 13 },

  sectionHeader: { marginTop: 21, marginBottom: 10 },
  sectionTitle: { color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '800' },
  grid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  impactCard: { flex: 1, minHeight: 125, borderRadius: 18, padding: 15, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  impactIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  impactValue: { marginTop: 13, color: partnerTheme.colors.ink, fontSize: 21, fontWeight: '800' },
  impactLabel: { marginTop: 4, color: partnerTheme.colors.inkMuted, fontSize: 8.5, lineHeight: 13 },

  monthCard: { flexDirection: 'row', borderRadius: 18, paddingVertical: 17, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  monthStat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  monthValue: { color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '800' },
  monthLabel: { marginTop: 4, color: partnerTheme.colors.inkMuted, fontSize: 7.5, textAlign: 'center' },

  settlementCard: { marginTop: 12, flexDirection: 'row', gap: 12, borderRadius: 18, padding: 15, backgroundColor: partnerTheme.colors.accentSoft },
  settlementIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  settlementBody: { flex: 1 },
  settlementEyebrow: { color: '#3C7B78', fontSize: 7.5, fontWeight: '800', letterSpacing: 0.9 },
  settlementValue: { marginTop: 4, color: partnerTheme.colors.ink, fontSize: 17, fontWeight: '800' },
  settlementText: { marginTop: 3, color: '#56716F', fontSize: 8.5, lineHeight: 13 },

  journeyLink: { marginTop: 14, minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 17, paddingHorizontal: 14, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  journeyIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  journeyBody: { flex: 1 },
  journeyTitle: { color: partnerTheme.colors.ink, fontSize: 10.5, fontWeight: '800' },
  journeyText: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 8.5, lineHeight: 13 },
});
