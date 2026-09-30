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
import { formatExternalPolicyNumber } from '@/lib/policy-number-display';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

type PolicyFilter = 'All' | 'Active' | 'Renewal Due' | 'Expired';
type PolicyCategoryFilter = 'All' | 'Motor' | 'Non-Motor' | 'Health' | 'Life';
type PolicyTone = 'active' | 'due' | 'expired';
type LifeHealthKind = 'Life' | 'Health';

type LifeHealthPolicyDetails = {
  premium_paying_term?: string | null;
  policy_duration?: string | null;
  payment_frequency?: string | null;
};

type LifeHealthCaseSnapshot = {
  final_policy_id: string | null;
  premium_paying_term?: string | null;
  policy_duration?: string | null;
  payment_frequency?: string | null;
  premium_amount?: number | null;
};

type PolicyRow = {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  insurance_company_id: string;
  policy_no: string;
  policy_type: string;
  business_line?: string | null;
  policy_product?: string | null;
  policy_term?: string | null;
  premium_amount?: number | null;
  life_health_policy_details?: LifeHealthPolicyDetails | LifeHealthPolicyDetails[] | null;
  start_date: string;
  end_date: string;
  source: 'sibl' | 'external';
  status?: string | null;
  superseded_by_policy_id?: string | null;
};

const POLICY_CATEGORY_OPTIONS: PolicyCategoryFilter[] = ['All', 'Motor', 'Non-Motor', 'Health', 'Life'];

export default function PoliciesScreen() {
  const router = useRouter();
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PolicyCategoryFilter>('All');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
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
        const [policyResult, externalPolicyResult, lifeHealthCaseResult, vehicleResult, companyResult] = await Promise.all([
          (supabase as any)
            .from('policies')
            .select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,business_line,policy_product,policy_term,premium_amount,start_date,end_date,status,superseded_by_policy_id,life_health_policy_details!life_health_policy_details_policy_id_fkey(premium_paying_term,policy_duration,payment_frequency)')
            .in('customer_id', ids)
            .order('end_date', { ascending: true }),
          (supabase as any)
            .from('external_policies')
            .select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date')
            .in('customer_id', ids)
            .order('end_date', { ascending: true }),
          (supabase as any)
            .from('life_health_cases')
            .select('final_policy_id,premium_paying_term,policy_duration,payment_frequency,premium_amount,converted_at')
            .in('customer_id', ids)
            .not('final_policy_id', 'is', null)
            .order('converted_at', { ascending: false }),
          supabase.from('vehicles').select('*').in('customer_id', ids),
          supabase.from('insurance_companies').select('*'),
        ]);

        if (!active) return;

        const latestCaseByPolicy = new Map<string, LifeHealthCaseSnapshot>();
        for (const row of (lifeHealthCaseResult.data ?? []) as (LifeHealthCaseSnapshot & { converted_at?: string | null })[]) {
          if (row.final_policy_id && !latestCaseByPolicy.has(row.final_policy_id)) {
            latestCaseByPolicy.set(row.final_policy_id, row);
          }
        }

        const internalPolicies = ((policyResult.data ?? []) as Omit<PolicyRow, 'source'>[]).map((policy) => {
          const caseSnapshot = latestCaseByPolicy.get(policy.id);
          const currentDetails = getLifeHealthDetails({ ...policy, source: 'sibl' as const });
          const mergedDetails = caseSnapshot
            ? {
                premium_paying_term: caseSnapshot.premium_paying_term ?? currentDetails?.premium_paying_term ?? null,
                policy_duration: caseSnapshot.policy_duration ?? currentDetails?.policy_duration ?? policy.policy_term ?? null,
                payment_frequency: caseSnapshot.payment_frequency ?? currentDetails?.payment_frequency ?? null,
              }
            : policy.life_health_policy_details;

          return {
            ...policy,
            premium_amount: policy.premium_amount ?? caseSnapshot?.premium_amount ?? null,
            life_health_policy_details: mergedDetails,
            source: 'sibl' as const,
          };
        });

        const externalPolicies = ((externalPolicyResult.data ?? []) as Omit<PolicyRow, 'source' | 'status' | 'superseded_by_policy_id' | 'business_line' | 'policy_product' | 'policy_term' | 'premium_amount' | 'life_health_policy_details'>[]).map((policy) => ({
          ...policy,
          source: 'external' as const,
          status: null,
          superseded_by_policy_id: null,
          business_line: null,
          policy_product: null,
          policy_term: null,
          premium_amount: null,
          life_health_policy_details: null,
        }));

        setPolicies(currentPoliciesByVehicle([...internalPolicies, ...externalPolicies]));
        setVehicles(vehicleResult.data ?? []);
        setCompanies(companyResult.data ?? []);
      }

      if (active) setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, [router]);

  if (loading) return <Screen title="My Policies"><LoadingState /></Screen>;

  const categoryPolicies = policies.filter((policy) => categoryFilter === 'All' || getPolicyCategory(policy) === categoryFilter);
  const filteredPolicies = policies.filter((policy) => {
    const vehicle = vehicles.find((item) => item.id === policy.vehicle_id);
    const company = companies.find((item) => item.id === policy.insurance_company_id);
    const tone = policyTone(policy.end_date);
    const details = getLifeHealthDetails(policy);
    const text = [
      policy.policy_no,
      policy.policy_type,
      policy.business_line,
      policy.policy_product,
      policy.policy_term,
      policy.premium_amount,
      details?.premium_paying_term,
      details?.policy_duration,
      details?.payment_frequency,
      vehicle?.vehicle_no,
      vehicle?.make,
      vehicle?.model,
      company?.name,
    ].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !query.trim() || text.includes(query.trim().toLowerCase());
    const matchesCategory = categoryFilter === 'All' || getPolicyCategory(policy) === categoryFilter;
    const matchesFilter = filter === 'All' || (filter === 'Renewal Due' ? tone === 'due' : filter.toLowerCase() === tone);
    return matchesSearch && matchesCategory && matchesFilter;
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

      <View style={styles.filterRow}>
        <View style={styles.categoryDropdownWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: categoryMenuOpen, selected: filter === 'All' }}
            onPress={() => setCategoryMenuOpen((open) => !open)}
            style={[
              styles.filterChip,
              styles.categoryDropdownChip,
              filter === 'All' && styles.filterChipActive,
            ]}
          >
            <Text style={[styles.filterText, filter === 'All' && styles.filterTextActive]}>
              {categoryFilter} ({countForCategory(categoryFilter, policies)})
            </Text>
            <MaterialCommunityIcons
              name={categoryMenuOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={filter === 'All' ? '#FFFFFF' : palette.slate}
            />
          </Pressable>

          {categoryMenuOpen ? (
            <View style={styles.categoryDropdownMenu}>
              {POLICY_CATEGORY_OPTIONS.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  onPress={() => {
                    setCategoryFilter(item);
                    setFilter('All');
                    setCategoryMenuOpen(false);
                  }}
                  style={[styles.categoryDropdownOption, categoryFilter === item && styles.categoryDropdownOptionActive]}
                >
                  <Text style={[styles.categoryDropdownOptionText, categoryFilter === item && styles.categoryDropdownOptionTextActive]}>
                    {item}
                  </Text>
                  <Text style={[styles.categoryDropdownOptionCount, categoryFilter === item && styles.categoryDropdownOptionTextActive]}>
                    {countForCategory(item, policies)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilterScroller} contentContainerStyle={styles.statusFilterWrap}>
          {(['Active', 'Renewal Due', 'Expired'] as PolicyFilter[]).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => {
                setFilter(item);
                setCategoryMenuOpen(false);
              }}
              style={[styles.filterChip, filter === item && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item} ({countForFilter(item, categoryPolicies)})</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {policies.length === 0 ? <EmptyState title="No policies yet" body="Add your current policy once and we will keep the vehicle cover visible here." actionLabel="Add Policy" onAction={() => router.push('/customer/add-policy')} icon="shield-plus-outline" /> : null}

      {filteredPolicies.map((policy) => {
        const vehicle = vehicles.find((item) => item.id === policy.vehicle_id);
        const company = companies.find((item) => item.id === policy.insurance_company_id);
        const days = daysUntil(policy.end_date);
        const tone = policyTone(policy.end_date);
        const colors = policyToneColors(tone);
        const manufacturerLogo = getVehicleBrandLogoSource(vehicle?.make);
        const insurerLogo = getInsurerLogoSource(company?.name);
        const lifeHealthKind = getLifeHealthKind(policy);

        return (
          <Pressable
            key={`${policy.source}-${policy.id}`}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/customer/policy-detail', params: { id: policy.id, source: policy.source } } as any)}
            style={({ pressed }) => [styles.policyCard, lifeHealthKind && styles.lifeHealthPolicyCard, pressed && styles.policyCardPressed]}
          >
            <View style={styles.accentBar} />

            {lifeHealthKind ? (
              <View style={styles.policyHeader}>
                <View style={styles.policyHeaderLeft}>
                  <Text style={[styles.stageLabel, policy.source === 'external' && styles.externalStageLabel]}>{policyStageLabel(policy, tone)}</Text>
                  <View style={[styles.sourcePill, { backgroundColor: colors.soft }]}>
                    <Text style={[styles.sourceText, { color: colors.accent }]}>{compactPolicyStatusLabel(tone, days)}</Text>
                  </View>
                </View>
                <View style={styles.lifeHealthTypePill}>
                  <Text style={styles.lifeHealthTypeText}>{lifeHealthKind.toUpperCase()}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.policyHeader}>
                <Text style={[styles.stageLabel, policy.source === 'external' && styles.externalStageLabel]}>{policyStageLabel(policy, tone)}</Text>
                <View style={[styles.sourcePill, { backgroundColor: colors.soft }]}>
                  <Text style={[styles.sourceText, { color: colors.accent }]}>{compactPolicyStatusLabel(tone, days)}</Text>
                </View>
              </View>
            )}

            {lifeHealthKind ? (
              <LifeHealthPolicyBody
                policy={policy}
                kind={lifeHealthKind}
                insurerLogo={insurerLogo}
                companyName={company?.name ?? '-'}
                toneColor={colors.accent}
              />
            ) : (
              <View style={styles.policyContentRow}>
                <PolicySummaryColumn
                  icon={insurerLogo}
                  fallbackIcon="shield-outline"
                  primaryValue={policy.source === 'external' ? formatExternalPolicyNumber(policy.policy_no) : policy.policy_no}
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
            )}
          </Pressable>
        );
      })}

      {policies.length > 0 && filteredPolicies.length === 0 ? <EmptyState title="No matching policy" body="Try another search or filter." actionLabel="Clear Filters" onAction={() => { setQuery(''); setCategoryFilter('All'); setFilter('All'); setCategoryMenuOpen(false); }} icon="filter-remove-outline" /> : null}
    </Screen>
  );
}

function LifeHealthPolicyBody({
  policy,
  kind,
  insurerLogo,
  companyName,
  toneColor,
}: {
  policy: PolicyRow;
  kind: LifeHealthKind;
  insurerLogo: ImageSourcePropType | null;
  companyName: string;
  toneColor: string;
}) {
  const details = getLifeHealthDetails(policy);
  const displayedPolicyNo = policy.source === 'external' ? formatExternalPolicyNumber(policy.policy_no) : policy.policy_no;
  const ppt = cleanDisplayValue(details?.premium_paying_term);
  const premiumAmount = formatPremiumAmount(policy.premium_amount);
  const productName = cleanDisplayValue(policy.policy_product);
  const paymentFrequency = cleanDisplayValue(details?.payment_frequency);
  const policyDuration = cleanDisplayValue(details?.policy_duration ?? policy.policy_term);

  return (
    <>
      <View style={styles.policyContentRow}>
        <PolicySummaryColumn
          icon={insurerLogo}
          fallbackIcon="shield-outline"
          primaryValue={displayedPolicyNo}
          secondaryValue={companyName}
          tertiaryValue={formatDate(policy.end_date)}
          tertiaryDotColor={toneColor}
        />
        <View style={styles.contentDivider} />
        <View style={styles.lifeHealthRightSummary}>
          <View style={styles.lifeHealthRightCopy}>
            <CompactLabelValue icon="cash" label="Premium Amount" value={premiumAmount} />
            <CompactLabelValue icon="calendar-range" label="PPT - Premium Paying Term" value={ppt} />
          </View>
        </View>
      </View>

      <View style={styles.lifeHealthMetricsRow}>
        <LifeHealthMetric icon="file-document-outline" label="Product Name" value={productName} />
        <View style={styles.lifeHealthMetricDivider} />
        <LifeHealthMetric icon="credit-card-outline" label="Payment Frequency" value={paymentFrequency} />
        <View style={styles.lifeHealthMetricDivider} />
        <LifeHealthMetric icon="calendar-clock-outline" label="PD - Policy Duration" value={policyDuration} />
      </View>

      <View style={styles.lifeHealthProtectionStrip}>
        <MaterialCommunityIcons name="shield-check" size={20} color={palette.navy} />
        <Text style={styles.lifeHealthProtectionText} numberOfLines={1}>
          {kind === 'Health' ? 'Stay protected. Stay healthy.' : 'Protecting what matters most.'}
        </Text>
        <View style={styles.lifeHealthProtectionArt}>
          <MaterialCommunityIcons name={kind === 'Health' ? 'heart-pulse' : 'heart-outline'} size={25} color="#D7262E" />
        </View>
      </View>
    </>
  );
}

function CompactLabelValue({
  icon,
  label,
  value,
}: {
  icon: 'cash' | 'calendar-range';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.compactLabelValueRow}>
      <MaterialCommunityIcons name={icon} size={15} color={palette.navy} />
      <View style={styles.compactLabelValueCopy}>
        <Text style={styles.compactLabel} numberOfLines={2}>{label}</Text>
        <Text style={styles.compactValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function LifeHealthMetric({
  icon,
  label,
  value,
}: {
  icon: 'file-document-outline' | 'credit-card-outline' | 'calendar-clock-outline';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.lifeHealthMetric}>
      <View style={styles.lifeHealthMetricIcon}>
        <MaterialCommunityIcons name={icon} size={17} color={palette.navy} />
      </View>
      <View style={styles.lifeHealthMetricCopy}>
        <Text style={styles.lifeHealthMetricLabel} numberOfLines={2}>{label}</Text>
        <Text style={styles.lifeHealthMetricValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
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

function getLifeHealthKind(policy: PolicyRow): LifeHealthKind | null {
  const businessLine = (policy.business_line ?? '').trim().toLowerCase();
  const policyType = (policy.policy_type ?? '').trim().toLowerCase();
  if (businessLine === 'life' || policyType === 'life') return 'Life';
  if (businessLine === 'health' || policyType === 'health') return 'Health';
  return null;
}

function getPolicyCategory(policy: PolicyRow): Exclude<PolicyCategoryFilter, 'All'> {
  const lifeHealthKind = getLifeHealthKind(policy);
  if (lifeHealthKind) return lifeHealthKind;

  const normalized = `${policy.business_line ?? ''} ${policy.policy_type ?? ''}`.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.includes('nonmotor')) return 'Non-Motor';
  if (normalized.includes('motor')) return 'Motor';
  return policy.vehicle_id ? 'Motor' : 'Non-Motor';
}

function getLifeHealthDetails(policy: PolicyRow) {
  const details = policy.life_health_policy_details;
  return Array.isArray(details) ? details[0] ?? null : details ?? null;
}

function cleanDisplayValue(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned || '-';
}

function formatPremiumAmount(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function currentPoliciesByVehicle(policies: PolicyRow[]) {
  const candidates = policies.filter((policy) => {
    if (policy.superseded_by_policy_id) return false;
    return !['superseded', 'cancelled', 'canceled', 'rejected', 'void'].includes((policy.status ?? '').trim().toLowerCase());
  });

  const latestByVehicle = new Map<string, PolicyRow>();
  for (const policy of candidates) {
    const groupingKey = policy.vehicle_id ? `vehicle:${policy.vehicle_id}` : `policy:${policy.source}:${policy.id}`;
    const existing = latestByVehicle.get(groupingKey);
    if (!existing || comparePolicyRecency(policy, existing) > 0) {
      latestByVehicle.set(groupingKey, policy);
    }
  }

  return Array.from(latestByVehicle.values()).sort(
    (a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime(),
  );
}

function comparePolicyRecency(a: PolicyRow, b: PolicyRow) {
  const startDifference = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  if (startDifference !== 0) return startDifference;

  const endDifference = new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
  if (endDifference !== 0) return endDifference;

  if (a.source !== b.source) return a.source === 'sibl' ? 1 : -1;
  return a.id.localeCompare(b.id);
}

function countForCategory(filter: PolicyCategoryFilter, policies: PolicyRow[]) {
  return policies.filter((policy) => filter === 'All' || getPolicyCategory(policy) === filter).length;
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
  filterRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, zIndex: 20 },
  categoryDropdownWrap: { position: 'relative', zIndex: 30, marginRight: 8 },
  categoryDropdownChip: { flexDirection: 'row', gap: 3, paddingHorizontal: 10 },
  categoryDropdownMenu: { position: 'absolute', top: 38, left: 0, width: 138, zIndex: 40, elevation: 10, borderRadius: 12, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', paddingVertical: 4, shadowColor: palette.ink, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  categoryDropdownOption: { minHeight: 34, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryDropdownOptionActive: { backgroundColor: '#EEF4FB' },
  categoryDropdownOptionText: { color: palette.slate, fontSize: 11, fontWeight: '900' },
  categoryDropdownOptionCount: { color: '#7B8798', fontSize: 10.5, fontWeight: '900' },
  categoryDropdownOptionTextActive: { color: palette.navy },
  statusFilterScroller: { flex: 1, maxHeight: 42 },
  statusFilterWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 14 },
  filterChip: { height: 34, borderRadius: 999, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: palette.navy, borderColor: palette.navy },
  filterText: { color: palette.slate, fontSize: 11.5, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  policyCard: { backgroundColor: '#FBFCFE', borderWidth: 1, borderColor: '#D8E3EE', borderRadius: 18, padding: 12, paddingLeft: 17, marginBottom: 10, overflow: 'hidden', shadowColor: palette.ink, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  lifeHealthPolicyCard: { paddingBottom: 11 },
  policyCardPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: palette.navy },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 22 },
  policyHeaderLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  stageLabel: { color: palette.navy, fontSize: 9.8, fontWeight: '900', letterSpacing: 0.6 },
  externalStageLabel: { color: '#0A43A3' },
  sourcePill: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3 },
  sourceText: { fontSize: 7.8, fontWeight: '900' },
  lifeHealthTypePill: { borderRadius: 999, backgroundColor: palette.navy, paddingHorizontal: 9, paddingVertical: 4 },
  lifeHealthTypeText: { color: '#FFFFFF', fontSize: 7.8, fontWeight: '900', letterSpacing: 0.45 },
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
  lifeHealthRightSummary: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, paddingVertical: 2 },
  lifeHealthRightCopy: { flex: 1, minWidth: 0, gap: 6 },
  compactLabelValueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, minWidth: 0 },
  compactLabelValueCopy: { flex: 1, minWidth: 0 },
  compactLabel: { color: '#7B8798', fontSize: 7.6, lineHeight: 9.5, fontWeight: '800' },
  compactValue: { color: palette.ink, fontSize: 10.5, lineHeight: 13, fontWeight: '900', marginTop: 1 },
  lifeHealthMetricsRow: { marginTop: 10, borderRadius: 12, backgroundColor: '#EFF6FD', paddingVertical: 8, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'stretch' },
  lifeHealthMetric: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  lifeHealthMetricIcon: { width: 28, height: 28, borderRadius: 999, backgroundColor: '#E3F0FC', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lifeHealthMetricCopy: { flex: 1, minWidth: 0 },
  lifeHealthMetricLabel: { color: '#6F7E90', fontSize: 7.1, lineHeight: 9, fontWeight: '800' },
  lifeHealthMetricValue: { color: palette.ink, fontSize: 9.8, lineHeight: 12, fontWeight: '900', marginTop: 2 },
  lifeHealthMetricDivider: { width: 1, backgroundColor: '#D7E4F1', marginHorizontal: 2 },
  lifeHealthProtectionStrip: { marginTop: 8, minHeight: 38, borderRadius: 11, backgroundColor: '#EFF6FD', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden' },
  lifeHealthProtectionText: { flex: 1, minWidth: 0, color: '#5F7082', fontSize: 9.5, lineHeight: 12, fontWeight: '800' },
  lifeHealthProtectionArt: { width: 38, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4F0FB', borderTopLeftRadius: 22, borderBottomLeftRadius: 22 },
});