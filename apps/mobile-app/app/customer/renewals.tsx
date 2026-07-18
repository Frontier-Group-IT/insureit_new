import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { buildComplianceRenewals, RENEWAL_DUE_WINDOW_DAYS, type ComplianceDocumentKey } from '@/lib/compliance-renewals';
import { getCurrentSession } from '@/lib/auth';
import { customerAccountTitle, getOperationalCustomerContexts } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Policy, Vehicle } from '@/lib/types';

type DataState = {
  vehicles: Vehicle[];
  policies: Policy[];
  accountNames: Map<string, string>;
};

const iconFor: Record<ComplianceDocumentKey, keyof typeof MaterialCommunityIcons.glyphMap> = {
  insurance_policy: 'shield-check-outline',
  national_permit: 'map-marker-distance',
  local_permit: 'map-marker-radius-outline',
  road_tax: 'receipt-text-outline',
  puc: 'smoke-detector-outline',
  fitness: 'clipboard-pulse-outline',
  dl: 'card-account-details-outline',
};

export default function ComplianceRenewalsScreen() {
  const router = useRouter();
  const [data, setData] = useState<DataState>({ vehicles: [], policies: [], accountNames: new Map() });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const contexts = await getOperationalCustomerContexts();
        const ids = contexts.map((context) => context.customer_id);
        const accountNames = new Map(contexts.map((context) => [context.customer_id, customerAccountTitle(context)]));
        if (!ids.length) {
          if (active) setData({ vehicles: [], policies: [], accountNames });
          return;
        }
        const [vehicleResult, policyResult] = await Promise.all([
          supabase.from('vehicles').select('*').in('customer_id', ids),
          supabase.from('policies').select('*').in('customer_id', ids),
        ]);
        if (vehicleResult.error || policyResult.error) throw vehicleResult.error ?? policyResult.error;
        if (active) setData({ vehicles: vehicleResult.data ?? [], policies: policyResult.data ?? [], accountNames });
      } catch (error) {
        console.warn('Compliance renewals load failed', error);
        if (active) setMessage('We could not load renewal details. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  const renewals = useMemo(() => buildComplianceRenewals({
    vehicles: data.vehicles,
    policies: data.policies,
    customerNames: data.accountNames,
  }), [data]);

  const expiredCount = renewals.summaries.reduce((total, item) => total + item.expired, 0);
  const expiredItems = renewals.items.filter((item) => item.status === 'expired');

  if (loading) return <Screen title="Renewals" showTitleHeader={false}><LoadingState /></Screen>;

  return (
    <Screen title="Renewals" showLogout showTitleHeader={false}>
      <View style={styles.focusPanel}>
        <View style={styles.focusTop}>
          <View style={styles.focusCopy}>
            <Text style={styles.pageTitle}>Pending Renewals</Text>
            <Text style={styles.pageSubtitle}>Compliance documents due within {RENEWAL_DUE_WINDOW_DAYS} days.</Text>
          </View>
          <View style={styles.totalBadge}>
            <Text style={styles.totalValue}>{expiredCount}</Text>
            <Text style={styles.totalLabel}>expired</Text>
          </View>
        </View>
      </View>
      {message ? <View style={styles.errorCard}><MaterialCommunityIcons name="alert-circle-outline" size={18} color="#B42318" /><Text style={styles.errorText}>{message}</Text></View> : null}

      <View style={styles.legendRow}>
        <LegendDot color="#B7791F" label="Due" />
        <LegendDot color="#C43D2D" label="Expired" />
      </View>

      <View style={styles.summaryGrid}>
        {renewals.summaries.map((summary) => (
          <View key={summary.key} style={[styles.summaryCard, !summary.tracked && styles.summaryCardDisabled]}>
            <View style={styles.summaryTop}>
              <View style={[styles.summaryIcon, summary.totalPending > 0 && styles.summaryIconHot]}>
                <MaterialCommunityIcons name={iconFor[summary.key]} size={18} color={summary.totalPending > 0 ? '#C43D2D' : '#0A43A3'} />
              </View>
              <Text style={styles.summaryTitle} numberOfLines={1}>{summary.title}</Text>
            </View>
            {summary.tracked ? (
              <View style={styles.metricsRow}>
                <Metric value={summary.due} tone="amber" />
                <Metric value={summary.expired} tone="red" />
              </View>
            ) : (
              <Text style={styles.notTracked}>Not tracked in vehicle records yet</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Expired documents</Text>
        <Text style={styles.sectionHint}>{expiredItems.length} expired item{expiredItems.length === 1 ? '' : 's'}</Text>
      </View>

      {expiredItems.length ? expiredItems.map((item) => (
        <Pressable key={item.id} onPress={() => router.push({ pathname: '/customer/vehicle-detail', params: { id: item.vehicleId } } as any)} style={({ pressed }) => [styles.itemRow, pressed && styles.itemPressed]}>
          <View style={[styles.itemIcon, styles.itemIconExpired]}>
            <MaterialCommunityIcons name={iconFor[item.key]} size={19} color="#C43D2D" />
          </View>
          <View style={styles.itemCopy}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemMeta} numberOfLines={1}>{item.vehicleNo} - {item.customerName}</Text>
            <Text style={styles.itemDate}>Expires {formatDate(item.expiryDate)}{item.meta ? ` - ${item.meta}` : ''}</Text>
          </View>
          <View style={[styles.statusPill, item.status === 'expired' && styles.statusPillExpired]}>
            <Text style={[styles.statusText, item.status === 'expired' && styles.statusTextExpired]}>{item.status === 'expired' ? 'Expired' : `${item.daysUntil}d`}</Text>
          </View>
        </Pressable>
      )) : <EmptyState title="No expired documents" body="Tracked vehicle compliance documents are not expired." />}
    </Screen>
  );
}

function Metric({ value, tone }: { value: number; tone: 'amber' | 'red' }) {
  const textStyle = tone === 'red' ? styles.metricRed : tone === 'amber' ? styles.metricAmber : styles.metricNavy;
  return <View style={styles.metric}><Text style={[styles.metricValue, textStyle]}>{value}</Text></View>;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  focusPanel: { borderRadius: 18, borderWidth: 1, borderColor: '#0A2D66', backgroundColor: palette.navy, padding: 12, marginTop: -40, marginBottom: 8, shadowColor: palette.ink, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  focusTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  focusCopy: { flex: 1, minWidth: 0 },
  pageTitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  pageSubtitle: { color: '#C9D7EF', fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  totalBadge: { minWidth: 70, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 11, paddingVertical: 8, alignItems: 'center' },
  totalValue: { color: '#FFFFFF', fontSize: 22, lineHeight: 25, fontWeight: '900' },
  totalLabel: { color: '#D8E7FF', fontSize: 9.5, fontWeight: '800', marginTop: 1 },
  errorCard: { borderRadius: 12, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: '#FEF3F2', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  errorText: { flex: 1, color: '#B42318', fontSize: 11, fontWeight: '700' },
  legendRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { color: '#667085', fontSize: 9, fontWeight: '900' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { width: '48.8%', borderRadius: 15, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', padding: 10 },
  summaryCardDisabled: { backgroundColor: '#F8FAFC' },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  summaryIconHot: { backgroundColor: '#FFF0EE' },
  summaryTitle: { flex: 1, color: palette.navy, fontSize: 13, fontWeight: '900' },
  metricsRow: { flexDirection: 'row', marginTop: 9, gap: 7 },
  metric: { flex: 1, minHeight: 35, borderRadius: 11, backgroundColor: '#F8FBFF', alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 17, fontWeight: '900' },
  metricAmber: { color: '#B7791F' },
  metricRed: { color: '#C43D2D' },
  metricNavy: { color: palette.navy },
  notTracked: { color: '#7A8799', fontSize: 9.5, lineHeight: 13, fontWeight: '700', marginTop: 8 },
  sectionHeader: { marginTop: 13, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' },
  sectionHint: { color: '#667085', fontSize: 10, fontWeight: '700' },
  itemRow: { borderRadius: 14, borderWidth: 1, borderColor: '#E2EAF4', backgroundColor: '#FFFFFF', padding: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  itemPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  itemIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFF7EA', alignItems: 'center', justifyContent: 'center' },
  itemIconExpired: { backgroundColor: '#FFF0EE' },
  itemCopy: { flex: 1, minWidth: 0 },
  itemTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  itemMeta: { color: '#526278', fontSize: 10.5, fontWeight: '800', marginTop: 2 },
  itemDate: { color: '#7A8799', fontSize: 9.5, fontWeight: '700', marginTop: 2 },
  statusPill: { minWidth: 46, borderRadius: 999, backgroundColor: '#FFF7EA', paddingHorizontal: 8, paddingVertical: 5, alignItems: 'center' },
  statusPillExpired: { backgroundColor: '#FFF0EE' },
  statusText: { color: '#B7791F', fontSize: 10, fontWeight: '900' },
  statusTextExpired: { color: '#C43D2D' },
});
