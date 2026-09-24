import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { AppSearchBar } from '@/components/design-system';
import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { getInsurerLogoSource, getVehicleBrandLogoSource } from '@/lib/catalog-logos';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

type PolicyFilter = 'All' | 'Active' | 'Renewal Due' | 'Expired';
type PolicyTone = 'active' | 'due' | 'expired';

type PolicyRow = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  insurance_company_id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  source: 'sibl' | 'external';
  created_at?: string | null;
  status?: string | null;
  supersedes_policy_id?: string | null;
  superseded_by_policy_id?: string | null;
};

export default function PoliciesScreen() {
  const router = useRouter();
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PolicyFilter>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const contexts = await getOperationalCustomerContexts();
      const ids = contexts.map((context) => context.customer_id);
      if (ids.length) {
        const [policyResult, externalPolicyResult, vehicleResult, companyResult] = await Promise.all([
          (supabase as any).from('policies').select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date,created_at,status,supersedes_policy_id,superseded_by_policy_id').in('customer_id', ids).order('end_date', { ascending: true }),
          (supabase as any).from('external_policies').select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date,created_at').in('customer_id', ids).order('end_date', { ascending: true }),
          supabase.from('vehicles').select('*').in('customer_id', ids),
          supabase.from('insurance_companies').select('*'),
        ]);
        if (!active) return;
        const combinedPolicies = [
          ...((policyResult.data ?? []) as Omit<PolicyRow, 'source'>[]).map((policy) => ({ ...policy, source: 'sibl' as const })),
          ...((externalPolicyResult.data ?? []) as Omit<PolicyRow, 'source'>[]).map((policy) => ({ ...policy, source: 'external' as const })),
        ];
        setPolicies(currentPolicyPerVehicle(combinedPolicies));
        setVehicles(vehicleResult.data ?? []);
        setCompanies(companyResult.data ?? []);
      }
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  if (loading) return <Screen title="My Policies"><LoadingState /></Screen>;

  const filteredPolicies = policies.filter((policy) => {
    const vehicle = vehicles.find((item) => item.id === policy.vehicle_id);
    const company = companies.find((item) => item.id === policy.insurance_company_id);
    const tone = policyTone(policy.end_date);
    const text = [policy.policy_no, policy.policy_type, vehicle?.vehicle_no, vehicle?.make, vehicle?.model, company?.name].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !query.trim() || text.includes(query.trim().toLowerCase());
    const matchesFilter = filter === 'All' || (filter === 'Renewal Due' ? tone === 'due' : filter.toLowerCase() === tone);
    return matchesSearch && matchesFilter;
  });

  return (
    <Screen title="My Policies" showLogout showTitleHeader={false}>
      <View style={styles.searchSection}>
        <View style={styles.searchHeadingRow}>
          <View>
            <Text style={styles.searchHeading}>Find your policy</Text>
            <Text style={styles.searchSubheading}>Search by vehicle, insurer or policy number</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/customer/add-policy')} style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
            <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add policy</Text>
          </Pressable>
        </View>
        <AppSearchBar value={query} onChangeText={setQuery} placeholder="Search vehicle, insurer or policy no." />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filterWrap}>
        {(['All', 'Active', 'Renewal Due', 'Expired'] as PolicyFilter[]).map((item) => (
          <Pressable key={item} accessibilityRole="button" onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item} ({countForFilter(item, policies)})</Text>
          </Pressable>
        ))}
      </ScrollView>

      {policies.length === 0 ? <EmptyState title="No policies yet" body="Add your current policy once and we will keep the vehicle cover visible here." actionLabel="Add Policy" onAction={() => router.push('/customer/add-policy')} icon="shield-plus-outline" /> : null}

      {filteredPolicies.map((policy) => {
        const vehicle = vehicles.find((item) => item.id === policy.vehicle_id);
        const company = companies.find((item) => item.id === policy.insurance_company_id);
        const days = daysUntil(policy.end_date);
        const tone = policyTone(policy.end_date);
        const colors = policyToneColors(tone);
        const manufacturerLogo = getVehicleBrandLogoSource(vehicle?.make);
        const insurerLogo = getInsurerLogoSource(company?.name);

        return (
          <Pressable
            key={`${policy.source}-${policy.id}`}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/customer/policy-detail', params: { id: policy.id, source: policy.source } } as any)}
            style={({ pressed }) => [styles.policyCard, pressed && styles.policyCardPressed]}
          >
            <View style={styles.accentBar} />

            <View style={styles.policyHeader}>
              <Text style={[styles.stageLabel, policy.source === 'external' && styles.externalStageLabel]}>{policyStageLabel(policy, tone)}</Text>
              <View style={[styles.sourcePill, { backgroundColor: colors.soft }]}>
                <Text style={[styles.sourceText, { color: colors.accent }]}>{compactPolicyStatusLabel(tone, days)}</Text>
              </View>
            </View>

            <View style={styles.policyContentRow}>
              <PolicySummaryColumn
                icon={insurerLogo}
                fallbackIcon="shield-outline"
                primaryValue={policy.policy_no}
                secondaryValue={company?.name ?? '-'}
                tertiaryValue={formatDate(policy.end_date)}
                tertiaryDotColor={colors.accent}
              />
              <View style={styles.contentDivider} />
              <PolicySummaryColumn
                icon={manufacturerLogo}
                fallbackIcon="car-side"
                primaryValue={vehicle?.vehicle_no ?? 'Vehicle unavailable'}
                secondaryValue={vehicle?.make ?? '-'}
                tertiaryValue={vehicle?.model ?? '-'}
                tertiaryMuted
              />
            </View>

          </Pressable>
        );
      })}

      {policies.length > 0 && filteredPolicies.length === 0 ? <EmptyState title="No matching policy" body="Try another search or filter." actionLabel="Clear Filters" onAction={() => { setQuery(''); setFilter('All'); }} icon="filter-remove-outline" /> : null}
    </Screen>
  );
}

function PolicySummaryColumn({
  icon,
  fallbackIcon,
  primaryValue,
  secondaryValue,
  tertiaryValue,
  tertiaryMuted = false,
  tertiaryDotColor,
}: {
  icon: ImageSourcePropType | null;
  fallbackIcon: 'car-side' | 'shield-outline';
  primaryValue: string;
  secondaryValue: string;
  tertiaryValue: string;
  tertiaryMuted?: boolean;
  tertiaryDotColor?: string;
}) {
  return (
    <View style={styles.summaryColumn}>
      <View style={styles.catalogIconWrap}>
        {icon ? (
          <Image source={icon} resizeMode="contain" style={styles.catalogIcon} />
        ) : (
          <MaterialCommunityIcons name={fallbackIcon} size={24} color={palette.navy} />
        )}
      </View>
      <View style={styles.summaryCopy}>
        <Text style={styles.summaryPrimary} numberOfLines={1}>{primaryValue}</Text>
        <Text style={styles.summarySecondary} numberOfLines={1}>{secondaryValue}</Text>
        <View style={styles.summaryTertiaryRow}>
          <Text style={[styles.summaryTertiary, tertiaryMuted && styles.summaryTertiaryMuted]} numberOfLines={1}>{tertiaryValue}</Text>
          {tertiaryDotColor ? <View style={[styles.expiryDot, { backgroundColor: tertiaryDotColor }]} /> : null}
        </View>
      </View>
    </View>
  );
}

function currentPolicyPerVehicle(policies: PolicyRow[]) {
  const visibleCandidates = policies.filter((policy) => {
    if (policy.source === 'external') return true;
    const status = (policy.status ?? '').trim().toLowerCase();
    if (policy.superseded_by_policy_id) return false;
    return !['superseded', 'cancelled', 'canceled', 'rejected', 'void'].includes(status);
  });

  const latestByVehicle = new Map<string, PolicyRow>();
  for (const policy of visibleCandidates) {
    const current = latestByVehicle.get(policy.vehicle_id);
    if (!current || comparePolicyRecency(policy, current) > 0) {
      latestByVehicle.set(policy.vehicle_id, policy);
    }
  }

  return Array.from(latestByVehicle.values()).sort(
    (a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime(),
  );
}

function comparePolicyRecency(a: PolicyRow, b: PolicyRow) {
  const endDateDiff = dateValue(a.end_date) - dateValue(b.end_date);
  if (endDateDiff !== 0) return endDateDiff;

  const startDateDiff = dateValue(a.start_date) - dateValue(b.start_date);
  if (startDateDiff !== 0) return startDateDiff;

  const createdAtDiff = dateValue(a.created_at) - dateValue(b.created_at);
  if (createdAtDiff !== 0) return createdAtDiff;

  if (a.source !== b.source) return a.source === 'sibl' ? 1 : -1;
  return a.id.localeCompare(b.id);
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function countForFilter(filter: PolicyFilter, policies: PolicyRow[]) {
  return policies.filter((policy) => {
    const tone = policyTone(policy.end_date);
    return filter === 'All' || (filter === 'Renewal Due' ? tone === 'due' : filter.toLowerCase() === tone);
  }).length;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function policyTone(endDate: string): PolicyTone {
  const days = daysUntil(endDate);
  return days < 0 ? 'expired' : days <= 30 ? 'due' : 'active';
}

function policyToneColors(tone: PolicyTone) {
  if (tone === 'expired') return { accent: '#D7262E', soft: '#FFF0F0', border: '#F3CCCC' };
  if (tone === 'due') return { accent: '#B7791F', soft: '#FFF6E8', border: '#F2D8A5' };
  return { accent: '#0F8A61', soft: '#EAF8F2', border: '#C7EAD9' };
}

function compactPolicyStatusLabel(tone: PolicyTone, days: number) {
  if (tone === 'expired') return `EXPIRED ${Math.abs(days)}d ago`;
  if (tone === 'due') return `DUE IN ${days}d`;
  return 'ACTIVE';
}

function policyStageLabel(policy: PolicyRow, tone: PolicyTone) {
  if (policy.source === 'external') return 'EXTERNAL POLICY';
  if (tone === 'expired') return 'EXPIRED COVER';
  if (tone === 'due') return 'RENEWAL STAGE';
  return 'ACTIVE COVER';
}

const styles = StyleSheet.create({
  searchSection: { marginTop: 0, marginBottom: 10 },
  searchHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  searchHeading: { color: palette.navy, fontSize: 13, fontWeight: '900' },
  searchSubheading: { color: palette.slate, fontSize: 10.5, lineHeight: 14, fontWeight: '700', marginTop: 2 },
  addButton: { minHeight: 34, borderRadius: 12, backgroundColor: palette.navy, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonPressed: { opacity: 0.84, transform: [{ scale: 0.96 }] },
  addButtonText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' },
  filterScroller: { maxHeight: 42, marginBottom: 12 },
  filterWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 14 },
  filterChip: { height: 34, borderRadius: 999, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: palette.navy, borderColor: palette.navy },
  filterText: { color: palette.slate, fontSize: 11.5, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  policyCard: { backgroundColor: '#FBFCFE', borderWidth: 1, borderColor: '#D8E3EE', borderRadius: 18, padding: 12, paddingLeft: 17, marginBottom: 10, overflow: 'hidden', shadowColor: palette.ink, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  policyCardPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: palette.navy },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 22 },
  stageLabel: { color: palette.navy, fontSize: 9.8, fontWeight: '900', letterSpacing: 0.6 },
  externalStageLabel: { color: '#0A43A3' },
  sourcePill: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3 },
  sourceText: { fontSize: 7.8, fontWeight: '900' },
  policyContentRow: { marginTop: 10, flexDirection: 'row', alignItems: 'stretch' },
  summaryColumn: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, paddingVertical: 4 },
  contentDivider: { width: 1, backgroundColor: '#E1E8F0', marginHorizontal: 10, marginVertical: 2 },
  catalogIconWrap: { width: 42, height: 42, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4EAF1', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  catalogIcon: { width: 34, height: 34 },
  summaryCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  summaryPrimary: { color: palette.ink, fontSize: 12.4, lineHeight: 16, fontWeight: '900' },
  summarySecondary: { color: palette.ink, fontSize: 10.8, lineHeight: 14, fontWeight: '800', marginTop: 2 },
  summaryTertiaryRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  summaryTertiary: { color: '#64748B', fontSize: 10.4, lineHeight: 13, fontWeight: '700', flexShrink: 1 },
  summaryTertiaryMuted: { color: '#97A2B2', fontWeight: '700' },
  expiryDot: { width: 6, height: 6, borderRadius: 999, flexShrink: 0 },
  cardFooter: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#E5ECF5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerHint: { color: palette.slate, fontSize: 11.5, fontWeight: '900' },
});
