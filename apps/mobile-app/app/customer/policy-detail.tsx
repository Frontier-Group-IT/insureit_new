import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

type PolicyDisplay = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  insurance_company_id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium_amount?: number | null;
  insured_declared_value?: number | null;
  source: 'sibl' | 'external';
};

export default function PolicyDetailScreen() {
  const router = useRouter();
  const { id, source } = useLocalSearchParams<{ id: string; source?: 'sibl' | 'external' }>();
  const [policy, setPolicy] = useState<PolicyDisplay | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [company, setCompany] = useState<InsuranceCompany | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!id) return;
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const contexts = await getOperationalCustomerContexts();
      const ids = contexts.map((context) => context.customer_id);
      if (!ids.length) {
        if (active) setLoading(false);
        return;
      }

      let next: any = null;
      let nextSource: 'sibl' | 'external' = source === 'external' ? 'external' : 'sibl';
      if (source === 'external') {
        const result = await (supabase as any).from('external_policies').select('*').eq('id', id).in('customer_id', ids).maybeSingle();
        next = result.data;
      } else {
        const result = await supabase.from('policies').select('*').eq('id', id).in('customer_id', ids).maybeSingle();
        next = result.data;
        if (!next) {
          const externalResult = await (supabase as any).from('external_policies').select('*').eq('id', id).in('customer_id', ids).maybeSingle();
          next = externalResult.data;
          if (next) nextSource = 'external';
        }
      }

      if (!active) return;
      if (next) setPolicy({ ...next, source: nextSource });
      if (next) {
        const [vehicleResult, companyResult] = await Promise.all([
          supabase.from('vehicles').select('*').eq('id', next.vehicle_id).in('customer_id', ids).maybeSingle(),
          supabase.from('insurance_companies').select('*').eq('id', next.insurance_company_id).maybeSingle(),
        ]);
        if (!active) return;
        setVehicle(vehicleResult.data);
        setCompany(companyResult.data);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, router, source]);

  const renewalState = useMemo(() => {
    if (!policy) return { label: 'Unavailable', action: false, tone: 'neutral' as const, helper: '' };
    const days = Math.ceil((new Date(policy.end_date).getTime() - Date.now()) / 86400000);
    if (days < 0) return { label: 'Expired', action: true, tone: 'danger' as const, helper: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago` };
    if (days <= 30) return { label: 'Renewal due', action: true, tone: 'warning' as const, helper: `${days} day${days === 1 ? '' : 's'} left to renew` };
    return { label: 'Active', action: false, tone: 'success' as const, helper: `${days} day${days === 1 ? '' : 's'} remaining` };
  }, [policy]);

  if (loading) return <Screen title="Policy Detail"><LoadingState /></Screen>;
  if (!policy) return <Screen title="Policy Detail"><EmptyState title="Policy not found" body="Please choose another policy from your list." /></Screen>;

  return (
    <Screen title="Policy Detail" subtitle={vehicle?.vehicle_no ?? policy.policy_no} showLogout showTitleHeader={false}>
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name={policy.source === 'external' ? 'account-edit-outline' : 'shield-check-outline'} size={25} color="#FFF" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>POLICY DETAIL</Text>
            <Text style={styles.vehicleNo} numberOfLines={1}>{vehicle?.vehicle_no ?? 'Vehicle unavailable'}</Text>
            <Text style={styles.insurerName} numberOfLines={1}>{company?.name ?? 'Insurer pending'}</Text>
          </View>
          <StatusBadge state={renewalState.tone} label={renewalState.label} />
        </View>
        <View style={styles.heroMetaRow}>
          <HeroMetric label="Valid till" value={formatDate(policy.end_date)} />
          <HeroMetric label="Cover left" value={renewalState.helper || '-'} />
        </View>
        {policy.source === 'external' ? (
          <View style={styles.externalNotice}>
            <MaterialCommunityIcons name="account-edit-outline" size={15} color="#9EC5FF" />
            <Text style={styles.externalText}>Customer-added policy kept outside Sankalp business register</Text>
          </View>
        ) : null}
      </View>

      <Card style={styles.snapshotCard}>
        <SectionTitle icon="shield-check-outline" title="Policy snapshot" hint="Core cover information" />
        <View style={styles.detailGrid}>
          <DetailCell icon="file-document-outline" label="Policy number" value={policy.policy_no} />
          <DetailCell icon="car-outline" label="Policy type" value={policy.policy_type} />
          <DetailCell icon="calendar-start-outline" label="Start date" value={formatDate(policy.start_date)} />
          <DetailCell icon="calendar-check-outline" label="End date" value={formatDate(policy.end_date)} />
          <DetailCell icon="cash-multiple" label="Premium" value={formatCurrency(policy.premium_amount)} />
          <DetailCell icon="car-key" label="IDV" value={formatCurrency(policy.insured_declared_value)} />
        </View>
      </Card>

      <Card style={styles.vehicleCard}>
        <SectionTitle icon="truck-outline" title="Linked vehicle" hint={[vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || vehicle?.vehicle_type || 'Vehicle record'} />
        <View style={styles.vehicleFacts}>
          <CompactFact label="Vehicle number" value={vehicle?.vehicle_no} />
          <CompactFact label="Vehicle type" value={vehicle?.vehicle_type} />
          <CompactFact label="Chassis no." value={vehicle?.chassis_no} />
        </View>
      </Card>

      {renewalState.action ? (
        <Pressable onPress={() => router.push({ pathname: '/customer/add-policy', params: { vehicleId: policy.vehicle_id } } as any)} style={({ pressed }) => [styles.renewButton, pressed && styles.renewButtonPressed]}>
          <View style={styles.renewIcon}><MaterialCommunityIcons name="refresh" size={21} color="#FFF" /></View>
          <View style={styles.renewCopy}>
            <Text style={styles.renewTitle}>Renew this policy</Text>
            <Text style={styles.renewText}>Add renewed details for this vehicle.</Text>
          </View>
          <MaterialCommunityIcons name="arrow-right" size={21} color="#FFF" />
        </Pressable>
      ) : null}
    </Screen>
  );
}

function StatusBadge({ state, label }: { state: 'success' | 'warning' | 'danger' | 'neutral'; label: string }) {
  const config = {
    success: { bg: '#D9FBEA', text: '#067647' },
    warning: { bg: '#FFF0D2', text: '#B7791F' },
    danger: { bg: '#FFE1E1', text: '#C43838' },
    neutral: { bg: '#EEF2F6', text: '#64748B' },
  }[state];
  return <View style={[styles.statusBadge, { backgroundColor: config.bg }]}><Text style={[styles.statusText, { color: config.text }]}>{label}</Text></View>;
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.heroMetric}><Text style={styles.heroMetricLabel}>{label}</Text><Text style={styles.heroMetricValue} numberOfLines={1}>{value}</Text></View>;
}

function SectionTitle({ icon, title, hint }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; hint: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={18} color={palette.navy} /></View>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionHint} numberOfLines={1}>{hint}</Text>
      </View>
    </View>
  );
}

function DetailCell({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value?: string | null }) {
  return (
    <View style={styles.detailCell}>
      <MaterialCommunityIcons name={icon} size={15} color="#718096" />
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={2}>{value || '-'}</Text>
      </View>
    </View>
  );
}

function CompactFact({ label, value }: { label: string; value?: string | null }) {
  return <View style={styles.factRow}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue} numberOfLines={1}>{value || '-'}</Text></View>;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

function formatCurrency(value?: number | null) {
  return value === null || value === undefined ? '-' : `INR ${Number(value).toLocaleString('en-IN')}`;
}

const styles = StyleSheet.create({
  heroCard: { minHeight: 178, borderRadius: 22, backgroundColor: palette.navy, padding: 15, marginTop: -22, marginBottom: 12, overflow: 'hidden' },
  heroGlow: { position: 'absolute', right: -64, top: -50, width: 168, height: 168, borderRadius: 90, backgroundColor: 'rgba(11,99,206,0.44)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#B9D5FF', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  vehicleNo: { color: '#FFFFFF', fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 2 },
  insurerName: { color: '#D7E7FF', fontSize: 12.5, lineHeight: 16, fontWeight: '800', marginTop: 2 },
  heroMetaRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  heroMetric: { flex: 1, minHeight: 55, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, justifyContent: 'center' },
  heroMetricLabel: { color: '#B9D5FF', fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase' },
  heroMetricValue: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900', marginTop: 4 },
  externalNotice: { minHeight: 34, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 9, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  externalText: { flex: 1, color: '#D7E7FF', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 9.5, fontWeight: '900' },
  snapshotCard: { backgroundColor: '#F8FBFF', borderColor: '#D7E6FA' },
  vehicleCard: { backgroundColor: '#FFFFFF', borderColor: '#DCE8F4' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  sectionIcon: { width: 36, height: 36, borderRadius: radii.sm, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: palette.navy, fontSize: 14.5, lineHeight: 18, fontWeight: '900' },
  sectionHint: { color: palette.slate, fontSize: 11, lineHeight: 14, fontWeight: '700', marginTop: 1 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 0 },
  detailCell: { width: '48%', minHeight: 52, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5ECF5', flexDirection: 'row', gap: 7 },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: { color: '#64748B', fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase' },
  detailValue: { color: palette.ink, fontSize: 12, lineHeight: 15, fontWeight: '800', marginTop: 4 },
  vehicleFacts: { borderRadius: 15, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E3ECF6', overflow: 'hidden' },
  factRow: { minHeight: 43, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#E7EEF7' },
  factLabel: { width: 104, color: palette.slate, fontSize: 11, fontWeight: '800' },
  factValue: { flex: 1, color: palette.navy, fontSize: 12.5, fontWeight: '900', textAlign: 'right' },
  renewButton: { minHeight: 62, borderRadius: 18, backgroundColor: palette.navy, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  renewButtonPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  renewIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.14)' },
  renewCopy: { flex: 1, minWidth: 0 },
  renewTitle: { color: '#FFF', fontSize: 14.5, fontWeight: '900' },
  renewText: { color: '#C9D7EF', fontSize: 11.5, fontWeight: '700', marginTop: 2 },
});
