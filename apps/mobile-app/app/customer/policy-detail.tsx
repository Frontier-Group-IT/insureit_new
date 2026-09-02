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
    <Screen title="Policy details" subtitle={vehicle?.vehicle_no ?? policy.policy_no} showLogout showTitleHeader={false}>
      <Text style={styles.pageTitle}>Policy details</Text>
      <View style={styles.contentStack}>
        <View style={styles.heroLayout}>
          <View style={styles.heroAccent} />
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name={policy.source === 'external' ? 'account-edit-outline' : 'shield-check-outline'} size={25} color={renewalTone(renewalState.tone).accent} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.eyebrow, { color: renewalTone(renewalState.tone).accent }]}>POLICY DETAIL</Text>
              <Text style={styles.policyNo} numberOfLines={2}>{policy.policy_no}</Text>
              <Text style={styles.policyType} numberOfLines={1}>{policy.policy_type || 'Policy'}</Text>
            </View>
            <StatusBadge state={renewalState.tone} label={renewalState.label} />
          </View>
          <View style={styles.heroMetaRow}>
            <HeroMetric label="Insurer" value={company?.name ?? 'Insurer pending'} />
            <HeroMetric label="Cover left" value={renewalState.helper || '-'} />
          </View>
          <View style={styles.heroMetaRow}>
            <HeroMetric label="Start date" value={formatDate(policy.start_date)} />
            <HeroMetric label="End date" value={formatDate(policy.end_date)} />
          </View>
          {renewalState.action ? <View style={styles.heroActionRow}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/customer/add-policy', params: { vehicleId: policy.vehicle_id } })} style={({ pressed }) => [styles.heroAction, { backgroundColor: renewalTone(renewalState.tone).accent }, pressed && styles.heroActionPressed]}>
              <MaterialCommunityIcons name="refresh" size={15} color="#FFFFFF" />
              <Text style={styles.heroActionText}>Add renewed policy</Text>
            </Pressable>
          </View> : null}
        </View>

        <Card style={styles.financialCard}>
          <SectionTitle icon="cash-multiple" title="Financial summary" />
          <View style={styles.financialGrid}>
            <FinancialValue label="Premium" value={formatCurrency(policy.premium_amount)} primary />
            <FinancialValue label="IDV" value={formatCurrency(policy.insured_declared_value)} />
          </View>
        </Card>

        <Card style={styles.vehicleCard}>
          <SectionTitle icon="truck-outline" title="Linked vehicle" hint={[vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || vehicle?.vehicle_type || 'Vehicle record'} />
          <View style={styles.vehicleFacts}>
            <CompactFact label="Vehicle number" value={vehicle?.vehicle_no} />
            <CompactFact label="Vehicle type" value={vehicle?.vehicle_type} />
          </View>
          {vehicle ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/customer/vehicle-detail', params: { id: vehicle.id } } as any)} style={({ pressed }) => [styles.vehicleLink, pressed && styles.vehicleLinkPressed]}>
            <Text style={styles.vehicleLinkText}>View vehicle details</Text>
            <MaterialCommunityIcons name="arrow-right" size={17} color={palette.navy} />
          </Pressable> : null}
        </Card>
      </View>
    </Screen>
  );
}

function StatusBadge({ state, label }: { state: 'success' | 'warning' | 'danger' | 'neutral'; label: string }) {
  const config = {
    success: { border: '#8FD7B7', text: '#067647' },
    warning: { border: '#E7C46E', text: '#B7791F' },
    danger: { border: '#E7A0A0', text: '#C43838' },
    neutral: { border: '#CBD5E1', text: '#64748B' },
  }[state];
  return <View style={[styles.statusBadge, { borderColor: config.border }]}><Text style={[styles.statusText, { color: config.text }]}>{label}</Text></View>;
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.heroMetric}><Text style={styles.heroMetricLabel}>{label}</Text><Text style={styles.heroMetricValue} numberOfLines={1}>{value}</Text></View>;
}

function FinancialValue({ label, value, primary = false }: { label: string; value: string; primary?: boolean }) {
  return <View style={[styles.financialValue, primary && styles.financialValuePrimary]}><Text style={styles.financialLabel}>{label}</Text><Text style={styles.financialAmount} numberOfLines={1}>{value}</Text></View>;
}

function SectionTitle({ icon, title, hint }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; hint?: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={18} color={palette.navy} /></View>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint} numberOfLines={1}>{hint}</Text> : null}
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

function renewalTone(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return { accent: '#12805C', soft: '#E8F8F0', background: '#F7FCF9', border: '#BFE6D5' };
  if (tone === 'warning') return { accent: '#B7791F', soft: '#FFF4E2', background: '#FFFBF3', border: '#F0D9AC' };
  if (tone === 'danger') return { accent: '#C43838', soft: '#FDECEC', background: '#FFF8F8', border: '#F2C6C6' };
  return { accent: '#64748B', soft: '#EEF2F6', background: '#F8FAFC', border: '#DCE6F0' };
}

const styles = StyleSheet.create({
  pageTitle: { color: palette.navy, fontSize: 22, lineHeight: 28, fontWeight: '900', marginBottom: 10 },
  contentStack: { alignSelf: 'stretch', flexGrow: 0, flexShrink: 1 },
  heroLayout: { alignSelf: 'stretch', flexGrow: 0, flexShrink: 1, minHeight: 0, maxHeight: 300, marginBottom: 9, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 13, overflow: 'hidden' },
  heroAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: palette.navy },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5EBF3', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#64748B', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  policyNo: { color: palette.navy, fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 1 },
  policyType: { color: '#475569', fontSize: 12, lineHeight: 15, fontWeight: '800', marginTop: 1 },
  heroMetaRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  heroMetric: { flex: 1, minHeight: 50, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E8F0', paddingHorizontal: 9, justifyContent: 'center' },
  heroMetricLabel: { color: '#64748B', fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' },
  heroMetricValue: { color: palette.navy, fontSize: 11, fontWeight: '900', marginTop: 3 },
  heroActionRow: { marginTop: 8 },
  heroAction: { alignSelf: 'stretch', minHeight: 32, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroActionPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  heroActionText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: '#FFFFFF', borderWidth: 1 },
  statusText: { fontSize: 9, fontWeight: '900' },
  financialCard: { backgroundColor: '#FFFFFF', borderColor: '#DCE8F4', padding: 13, marginBottom: 9 },
  vehicleCard: { backgroundColor: '#FFFFFF', borderColor: '#DCE8F4', padding: 13 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  sectionIcon: { width: 34, height: 34, borderRadius: radii.sm, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: palette.navy, fontSize: 14, lineHeight: 17, fontWeight: '900' },
  sectionHint: { color: palette.slate, fontSize: 10.5, lineHeight: 13, fontWeight: '700', marginTop: 1 },
  financialGrid: { flexDirection: 'row', gap: 8 },
  financialValue: { flex: 1, minHeight: 58, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E8F0', padding: 10, justifyContent: 'center' },
  financialValuePrimary: { borderColor: '#D6E2EF', backgroundColor: '#FFFFFF' },
  financialLabel: { color: '#64748B', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  financialAmount: { color: palette.navy, fontSize: 15, fontWeight: '900', marginTop: 4 },
  vehicleFacts: { borderRadius: 13, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E3ECF6', overflow: 'hidden' },
  factRow: { minHeight: 39, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#E7EEF7' },
  factLabel: { width: 100, color: palette.slate, fontSize: 10.5, fontWeight: '800' },
  factValue: { flex: 1, color: palette.navy, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  vehicleLink: { minHeight: 35, marginTop: 8, borderRadius: 10, backgroundColor: '#EEF5FF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vehicleLinkPressed: { opacity: 0.8 },
  vehicleLinkText: { color: palette.navy, fontSize: 10.5, fontWeight: '900' },
});
