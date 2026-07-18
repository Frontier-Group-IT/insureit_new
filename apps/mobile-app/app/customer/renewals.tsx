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
  const dueCount = renewals.summaries.reduce((total, item) => total + item.due, 0);

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
            <Text style={styles.totalValue}>{renewals.totalPending}</Text>
            <Text style={styles.totalLabel}>pending</Text>
          </View>
        </View>
        <View style={styles.kpiRow}>
          <Kpi label="Total documents" value={renewals.totalPending} tone="navy" />
          <Kpi label="Expired" value={expiredCount} tone="red" />
          <Kpi label="Due in 45 days" value={dueCount} tone="amber" />
        </View>
      </View>
      {message ? <View style={styles.errorCard}><MaterialCommunityIcons name="alert-circle-outline" size={18} color="#B42318" /><Text style={styles.errorText}>{message}</Text></View> : null}

      <View style={styles.summaryGrid}>
        {renewals.summaries.map((summary) => (
          <View key={summary.key} style={[styles.summaryCard, summary.key === 'dl' && styles.summaryCardWide, !summary.tracked && styles.summaryCardDisabled]}>
            <View style={styles.summaryTop}>
              <View style={[styles.summaryIcon, summary.totalPending > 0 && styles.summaryIconHot]}>
                <MaterialCommunityIcons name={iconFor[summary.key]} size={18} color={summary.totalPending > 0 ? '#C43D2D' : '#0A43A3'} />
              </View>
              <Text style={styles.summaryTitle} numberOfLines={1}>{summary.title}</Text>
            </View>
            {summary.tracked ? (
              <View style={styles.metricsRow}>
                <Metric label="Due" value={summary.due} tone="amber" />
                <Metric label="Expired" value={summary.expired} tone="red" />
                <Metric label="Pending" value={summary.totalPending} tone="navy" />
              </View>
            ) : (
              <Text style={styles.notTracked}>Not tracked in vehicle records yet</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Vehicle renewals</Text>
        <Text style={styles.sectionHint}>{renewals.items.length} item{renewals.items.length === 1 ? '' : 's'} need attention</Text>
      </View>

      {renewals.items.length ? renewals.items.map((item) => (
        <Pressable key={item.id} onPress={() => router.push({ pathname: '/customer/vehicle-detail', params: { id: item.vehicleId } } as any)} style={({ pressed }) => [styles.itemRow, pressed && styles.itemPressed]}>
          <View style={[styles.itemIcon, item.status === 'expired' && styles.itemIconExpired]}>
            <MaterialCommunityIcons name={iconFor[item.key]} size={19} color={item.status === 'expired' ? '#C43D2D' : '#B7791F'} />
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
      )) : <EmptyState title="No pending renewals" body="Tracked vehicle documents are clear for the next 45 days." />}
    </Screen>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'red' | 'navy' }) {
  const textStyle = tone === 'red' ? styles.metricRed : tone === 'amber' ? styles.metricAmber : styles.metricNavy;
  return <View style={styles.metric}><Text style={[styles.metricValue, textStyle]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'red' | 'navy' }) {
  const textStyle = tone === 'red' ? styles.kpiRed : tone === 'amber' ? styles.kpiAmber : styles.kpiNavy;
  return (
    <View style={styles.kpiCard}>
      <Text style={[styles.kpiValue, textStyle]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  focusPanel: { borderRadius: 18, borderWidth: 1, borderColor: '#CFE0F8', backgroundColor: '#FFFFFF', padding: 12, marginTop: -6, marginBottom: 9, shadowColor: palette.ink, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  focusTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  focusCopy: { flex: 1, minWidth: 0 },
  pageTitle: { color: palette.navy, fontSize: 16, lineHeight: 20, fontWeight: '900' },
  pageSubtitle: { color: palette.slate, fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  totalBadge: { minWidth: 70, borderRadius: 15, backgroundColor: palette.navy, paddingHorizontal: 11, paddingVertical: 8, alignItems: 'center' },
  totalValue: { color: '#FFFFFF', fontSize: 22, lineHeight: 25, fontWeight: '900' },
  totalLabel: { color: '#D8E7FF', fontSize: 9.5, fontWeight: '800', marginTop: 1 },
  kpiRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
  kpiCard: { flex: 1, minHeight: 54, borderRadius: 13, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E3ECF7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  kpiValue: { fontSize: 18, lineHeight: 21, fontWeight: '900' },
  kpiNavy: { color: palette.navy },
  kpiRed: { color: '#C43D2D' },
  kpiAmber: { color: '#B7791F' },
  kpiLabel: { color: '#667085', fontSize: 8.5, lineHeight: 11, fontWeight: '800', textAlign: 'center', marginTop: 2 },
  errorCard: { borderRadius: 12, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: '#FEF3F2', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  errorText: { flex: 1, color: '#B42318', fontSize: 11, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { width: '48.8%', borderRadius: 15, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', padding: 10 },
  summaryCardWide: { width: '100%' },
  summaryCardDisabled: { backgroundColor: '#F8FAFC' },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  summaryIconHot: { backgroundColor: '#FFF0EE' },
  summaryTitle: { flex: 1, color: palette.navy, fontSize: 13, fontWeight: '900' },
  metricsRow: { flexDirection: 'row', marginTop: 9, gap: 7 },
  metric: { flex: 1, minHeight: 42, borderRadius: 11, backgroundColor: '#F8FBFF', alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 15, fontWeight: '900' },
  metricAmber: { color: '#B7791F' },
  metricRed: { color: '#C43D2D' },
  metricNavy: { color: palette.navy },
  metricLabel: { color: '#667085', fontSize: 8.5, fontWeight: '800', marginTop: 1 },
  notTracked: { color: '#7A8799', fontSize: 10.5, fontWeight: '700', marginTop: 8 },
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
