import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { Card, EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { getInsurerLogoSource } from '@/lib/catalog-logos';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

const policyDetailIcons = {
  policy: require('../../assets/custom-icons/policy-detail/policy-booked.png'),
  insurer: require('../../assets/custom-icons/policy-detail/insurer.png'),
  renewal: require('../../assets/custom-icons/policy-detail/renewal.png'),
  premium: require('../../assets/custom-icons/policy-detail/premium.png'),
  idv: require('../../assets/custom-icons/policy-detail/idv.png'),
  vehicle: require('../../assets/custom-icons/policy-detail/linked-vehicle.png'),
} satisfies Record<string, ImageSourcePropType>;

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
          <View style={[styles.heroAccent, { backgroundColor: renewalTone(renewalState.tone).accent }]} />
          <View style={styles.heroTop}>
            <Text style={styles.policyNo} numberOfLines={1}>{policy.policy_no}</Text>
            <StatusBadge state={renewalState.tone} label={compactPolicyStatusLabel(policy.end_date)} />
          </View>
          <View style={styles.heroMetaRow}>
            <HeroMetric image={getInsurerLogoSource(company?.name) ?? policyDetailIcons.insurer} label="Insurer" value={company?.name ?? 'Insurer pending'} />
            <HeroMetric image={policyDetailIcons.policy} label="Policy product" value={formatPolicyType(policy.policy_type)} />
          </View>
          <View style={styles.heroMetaRow}>
            <DateFinancialMetric
              dateLabel="Start date"
              dateValue={formatDate(policy.start_date)}
              dateImage={policyDetailIcons.renewal}
              financialLabel="Premium"
              financialValue={formatCurrency(policy.premium_amount)}
              financialImage={policyDetailIcons.premium}
            />
            <DateFinancialMetric
              dateLabel="End date"
              dateValue={formatDate(policy.end_date)}
              dateImage={policyDetailIcons.renewal}
              financialLabel="IDV"
              financialValue={formatCurrency(policy.insured_declared_value)}
              financialImage={policyDetailIcons.idv}
            />
          </View>
          {renewalState.action ? <View style={styles.heroActionRow}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/customer/add-policy', params: { vehicleId: policy.vehicle_id } })} style={({ pressed }) => [styles.heroAction, { backgroundColor: renewalTone(renewalState.tone).accent }, pressed && styles.heroActionPressed]}>
              <MaterialCommunityIcons name="refresh" size={15} color="#FFFFFF" />
              <Text style={styles.heroActionText}>Add renewed policy</Text>
            </Pressable>
          </View> : null}
        </View>

        <Card style={styles.vehicleCard}>
          <SectionTitle image={policyDetailIcons.vehicle} title="Linked vehicle" hint={[vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || vehicle?.vehicle_type || 'Vehicle record'} strongIcon />
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
    success: { text: '#0F8A61', background: '#EAF8F2' },
    warning: { text: '#B7791F', background: '#FFF6E8' },
    danger: { text: '#D7262E', background: '#FFF0F0' },
    neutral: { text: '#64748B', background: '#F1F5F9' },
  }[state];

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.background }]}>
      <Text style={[styles.statusText, { color: config.text }]}>{label}</Text>
    </View>
  );
}

function HeroMetric({ image, label, value }: { image: ImageSourcePropType; label: string; value: string }) {
  return (
    <View style={styles.heroMetric}>
      <Image source={image} resizeMode="contain" style={styles.heroMetricIconImage} />
      <View style={styles.heroMetricCopy}>
        <Text style={styles.heroMetricLabel}>{label}</Text>
        <Text style={styles.heroMetricValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function DateFinancialMetric({
  dateLabel,
  dateValue,
  dateImage,
  financialLabel,
  financialValue,
  financialImage,
}: {
  dateLabel: string;
  dateValue: string;
  dateImage: ImageSourcePropType;
  financialLabel: string;
  financialValue: string;
  financialImage: ImageSourcePropType;
}) {
  return (
    <View style={styles.dateFinancialMetric}>
      <View style={styles.dateFinancialRow}>
        <Image source={dateImage} resizeMode="contain" style={styles.dateFinancialIcon} />
        <View style={styles.dateFinancialCopy}>
          <Text style={styles.heroMetricLabel}>{dateLabel}</Text>
          <Text style={styles.dateFinancialValue} numberOfLines={1}>{dateValue}</Text>
        </View>
      </View>
      <View style={styles.dateFinancialDivider} />
      <View style={styles.dateFinancialRow}>
        <Image source={financialImage} resizeMode="contain" style={styles.dateFinancialIcon} />
        <View style={styles.dateFinancialCopy}>
          <Text style={styles.financialInlineLabel}>{financialLabel}</Text>
          <Text style={styles.financialInlineValue} numberOfLines={1}>{financialValue}</Text>
        </View>
      </View>
    </View>
  );
}

function SectionTitle({ image, title, hint, strongIcon = false }: { image: ImageSourcePropType; title: string; hint?: string; strongIcon?: boolean }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionIcon, strongIcon && styles.sectionIconStrong]}>
        <Image source={image} resizeMode="contain" style={[styles.sectionIconImage, strongIcon && styles.sectionIconImageStrong]} />
      </View>
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

function formatPolicyType(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return 'Policy';
  if (/motor/i.test(normalized)) return 'Motor Insurance';
  if (/package/i.test(normalized)) return 'Package Insurance';
  return normalized;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function compactPolicyStatusLabel(endDate: string) {
  const days = daysUntil(endDate);
  if (days < 0) return `EXPIRED ${Math.abs(days)}d ago`;
  if (days <= 30) return `DUE IN ${days}d`;
  return 'ACTIVE';
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
  pageTitle: { color: palette.navy, fontSize: 21, lineHeight: 26, fontWeight: '900', marginBottom: 8 },
  contentStack: { alignSelf: 'stretch', flexGrow: 0, flexShrink: 1 },

  heroLayout: { alignSelf: 'stretch', flexGrow: 0, flexShrink: 1, minHeight: 0, marginBottom: 8, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 12, overflow: 'hidden' },
  heroAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 30 },
  policyNo: { color: palette.navy, fontSize: 16.5, lineHeight: 20, fontWeight: '900', flexShrink: 1 },

  heroMetaRow: { flexDirection: 'row', gap: 7, marginTop: 7 },
  heroMetric: { flex: 1, minHeight: 48, borderRadius: 11, backgroundColor: '#FBFCFE', borderWidth: 1, borderColor: '#E1E8F0', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroMetricIconImage: { width: 21, height: 21 },
  heroMetricCopy: { flex: 1, minWidth: 0 },
  heroMetricLabel: { color: '#64748B', fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' },
  heroMetricValue: { color: palette.navy, fontSize: 10.8, lineHeight: 14, fontWeight: '900', marginTop: 2 },
  dateFinancialMetric: { flex: 1, minHeight: 92, borderRadius: 11, backgroundColor: '#FBFCFE', borderWidth: 1, borderColor: '#E1E8F0', paddingHorizontal: 9, paddingVertical: 8 },
  dateFinancialRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 31 },
  dateFinancialIcon: { width: 21, height: 21 },
  dateFinancialCopy: { flex: 1, minWidth: 0 },
  dateFinancialValue: { color: palette.navy, fontSize: 10.8, lineHeight: 14, fontWeight: '900', marginTop: 2 },
  dateFinancialDivider: { height: 1, backgroundColor: '#E1E8F0', marginVertical: 6 },
  financialInlineLabel: { color: '#64748B', fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' },
  financialInlineValue: { color: palette.navy, fontSize: 10.8, lineHeight: 14, fontWeight: '900', marginTop: 2 },

  heroActionRow: { marginTop: 7 },
  heroAction: { alignSelf: 'stretch', minHeight: 31, borderRadius: 9, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroActionPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  heroActionText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },

  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statusText: { fontSize: 9, lineHeight: 12, fontWeight: '900' },

  vehicleCard: { backgroundColor: '#FFFFFF', borderColor: '#DCE8F4', padding: 12 },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  sectionIcon: { width: 34, height: 34, borderRadius: radii.sm, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  sectionIconStrong: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4F7FB' },
  sectionIconImage: { width: 25, height: 25 },
  sectionIconImageStrong: { width: 29, height: 29 },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: palette.navy, fontSize: 14, lineHeight: 17, fontWeight: '900' },
  sectionHint: { color: palette.slate, fontSize: 10.5, lineHeight: 13, fontWeight: '600', marginTop: 1 },

  vehicleFacts: { borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3ECF6', overflow: 'hidden' },
  factRow: { minHeight: 37, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#E7EEF7' },
  factLabel: { width: 100, color: palette.slate, fontSize: 10.5, fontWeight: '800' },
  factValue: { flex: 1, color: palette.navy, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  vehicleLink: { minHeight: 34, marginTop: 7, borderRadius: 9, backgroundColor: '#EEF5FF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vehicleLinkPressed: { opacity: 0.8 },
  vehicleLinkText: { color: palette.navy, fontSize: 10.5, fontWeight: '900' },
});
