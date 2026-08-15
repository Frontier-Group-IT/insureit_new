import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppSearchBar } from '@/components/design-system';
import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
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
          supabase.from('policies').select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date').in('customer_id', ids).order('end_date', { ascending: true }),
          (supabase as any).from('external_policies').select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date').in('customer_id', ids).order('end_date', { ascending: true }),
          supabase.from('vehicles').select('*').in('customer_id', ids),
          supabase.from('insurance_companies').select('*'),
        ]);
        if (!active) return;
        setPolicies([
          ...((policyResult.data ?? []) as Omit<PolicyRow, 'source'>[]).map((policy) => ({ ...policy, source: 'sibl' as const })),
          ...((externalPolicyResult.data ?? []) as Omit<PolicyRow, 'source'>[]).map((policy) => ({ ...policy, source: 'external' as const })),
        ].sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime()));
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
            <Text style={styles.addButtonText}>Add</Text>
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

        return (
          <Pressable
            key={`${policy.source}-${policy.id}`}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/customer/policy-detail', params: { id: policy.id, source: policy.source } } as any)}
            style={({ pressed }) => [styles.policyCard, { backgroundColor: colors.background, borderColor: colors.border }, pressed && styles.policyCardPressed]}
          >
            <View style={[styles.accentBar, { backgroundColor: colors.accent }]} />

            <View style={styles.policyTop}>
              <View style={[styles.statusIcon, { backgroundColor: colors.soft }]}>
                <MaterialCommunityIcons name={policyIcon(policy.source, tone)} size={23} color={colors.accent} />
              </View>

              <View style={styles.policyTitleCopy}>
                <View style={styles.stageRow}>
                  <Text style={[styles.stageLabel, { color: colors.accent }]}>{policyStageLabel(policy, tone)}</Text>
                  {policy.source === 'external' ? <View style={styles.sourcePill}><Text style={styles.sourceText}>CUSTOMER ADDED</Text></View> : null}
                </View>
                <Text style={styles.vehicleNo} numberOfLines={1}>{vehicle?.vehicle_no ?? 'Vehicle unavailable'}</Text>
              </View>

              <View style={[styles.statusBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.statusBadgeText}>{policyStatusLabel(tone)}</Text>
              </View>
            </View>

            <View style={styles.numberRow}>
              <View style={styles.numberBox}>
                <Text style={styles.numberLabel}>Policy No.</Text>
                <Text style={styles.numberValue} numberOfLines={2}>{policy.policy_no}</Text>
              </View>
              <View style={styles.numberBox}>
                <Text style={styles.numberLabel}>Type</Text>
                <Text style={styles.numberValue} numberOfLines={2}>{policy.policy_type || 'Policy'}</Text>
              </View>
            </View>

            <View style={styles.infoBox}>
              <InfoPair leftLabel="Manufacturer" leftValue={vehicle?.make ?? '-'} rightLabel="Model" rightValue={vehicle?.model ?? '-'} />
              <InfoPair leftLabel="Insurer" leftValue={company?.name ?? '-'} rightLabel="Source" rightValue={policy.source === 'external' ? 'Customer Added' : 'Sankalp'} />
              <InfoPair leftLabel="Start" leftValue={formatDate(policy.start_date)} rightLabel="Expiry" rightValue={formatDate(policy.end_date)} />
            </View>

            {tone !== 'active' ? (
              <View style={[styles.warningStrip, { backgroundColor: colors.soft, borderColor: colors.border }]}>
                <MaterialCommunityIcons name={tone === 'expired' ? 'alert-octagon-outline' : 'calendar-alert'} size={16} color={colors.accent} />
                <Text style={[styles.warningStripText, { color: colors.accent }]}>{tone === 'expired' ? `Expired ${Math.abs(days)}d ago` : `${days}d left for renewal`}</Text>
              </View>
            ) : null}

            <View style={styles.cardFooter}>
              <Text style={styles.footerHint}>{tone === 'active' ? `${days}d cover remaining` : 'Open renewal details'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.accent} />
            </View>
          </Pressable>
        );
      })}

      {policies.length > 0 && filteredPolicies.length === 0 ? <EmptyState title="No matching policy" body="Try another search or filter." actionLabel="Clear Filters" onAction={() => { setQuery(''); setFilter('All'); }} icon="filter-remove-outline" /> : null}
    </Screen>
  );
}

function InfoPair({ leftLabel, leftValue, rightLabel, rightValue }: { leftLabel: string; leftValue: string; rightLabel: string; rightValue: string }) {
  return (
    <View style={styles.infoPairRow}>
      <View style={styles.infoPairHalf}>
        <Text style={styles.infoPairText} numberOfLines={1}><Text style={styles.infoPairLabel}>{leftLabel}: </Text>{leftValue}</Text>
      </View>
      <View style={styles.infoPairHalf}>
        <Text style={styles.infoPairText} numberOfLines={1}><Text style={styles.infoPairLabel}>{rightLabel}: </Text>{rightValue}</Text>
      </View>
    </View>
  );
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
  if (tone === 'expired') return { accent: '#C43838', soft: '#FDECEC', background: '#FFF7F7', border: '#F2C6C6' };
  if (tone === 'due') return { accent: '#B7791F', soft: '#FFF4E2', background: '#FFFCF5', border: '#F7DCA2' };
  return { accent: '#12805C', soft: '#E8F8F0', background: '#F7FFFB', border: '#BFEBD0' };
}

function policyStatusLabel(tone: PolicyTone) {
  if (tone === 'expired') return 'Expired';
  if (tone === 'due') return 'Renewal Due';
  return 'Active';
}

function policyStageLabel(policy: PolicyRow, tone: PolicyTone) {
  if (policy.source === 'external') return 'EXTERNAL POLICY';
  if (tone === 'expired') return 'EXPIRED COVER';
  if (tone === 'due') return 'RENEWAL STAGE';
  return 'ACTIVE COVER';
}

function policyIcon(source: PolicyRow['source'], tone: PolicyTone): keyof typeof MaterialCommunityIcons.glyphMap {
  if (source === 'external') return 'account-edit-outline';
  if (tone === 'expired') return 'shield-alert-outline';
  if (tone === 'due') return 'calendar-alert';
  return 'shield-check-outline';
}

const styles = StyleSheet.create({
  searchSection: { marginTop: -22, marginBottom: 10 },
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
  policyCard: { borderWidth: 1, borderRadius: 18, padding: 12, paddingLeft: 17, marginBottom: 10, overflow: 'hidden', shadowColor: palette.ink, shadowOpacity: 0.055, shadowRadius: 10, elevation: 2 },
  policyCardPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  policyTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  policyTitleCopy: { flex: 1, minWidth: 0 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stageLabel: { fontSize: 9.8, fontWeight: '900', letterSpacing: 0.6 },
  vehicleNo: { color: palette.ink, fontSize: 17, fontWeight: '900', marginTop: 1 },
  sourcePill: { borderRadius: 999, backgroundColor: '#EAF2FF', paddingHorizontal: 6, paddingVertical: 3 },
  sourceText: { color: '#0A43A3', fontSize: 7.8, fontWeight: '900' },
  statusBadge: { maxWidth: 126, minHeight: 34, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  statusBadgeText: { color: '#FFFFFF', fontSize: 10.2, lineHeight: 13, fontWeight: '900', textAlign: 'center' },
  numberRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  numberBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: '#DCE8F4', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  numberLabel: { color: palette.slate, fontSize: 9.3, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  numberValue: { color: palette.ink, fontSize: 11.7, lineHeight: 15, fontWeight: '900', marginTop: 2 },
  infoBox: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#E5ECF5', gap: 5 },
  infoPairRow: { flexDirection: 'row', gap: 8 },
  infoPairHalf: { flex: 1, minWidth: 0 },
  infoPairText: { color: palette.ink, fontSize: 11.1, lineHeight: 15, fontWeight: '800' },
  infoPairLabel: { color: palette.slate, fontSize: 10.2, fontWeight: '900' },
  warningStrip: { marginTop: 9, borderRadius: 12, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  warningStripText: { flex: 1, fontSize: 10.8, fontWeight: '900' },
  cardFooter: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#E5ECF5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerHint: { color: palette.slate, fontSize: 11.5, fontWeight: '900' },
});
